import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { authenticate, type AuthenticatedRequest } from "../../middlewares/authenticate";
import { getFirestore, Timestamp } from "../../lib/firebase";
import { PaginationQuerySchema } from "../../lib/validation";

const router: IRouter = Router();

/**
 * Feed strategy: fan-out on read.
 *
 * Queries all followee shards in parallel (chunked by 30 to respect Firestore `in` limit),
 * merges results in memory, and returns a properly paginated page.
 *
 * Cursor format: ISO-8601 timestamp of the last post on the previous page.
 * Each shard filters `createdAt < cursorTimestamp` at the database level so we
 * never re-fetch already-seen posts.
 *
 * Requires a composite Firestore index: [authorId ASC, createdAt DESC].
 * For high-scale production, replace with fan-out-on-write via Cloud Functions
 * writing to feeds/{userId}/posts sub-collections. The API contract stays identical.
 */
router.get(
  "/feed",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const uid = (req as AuthenticatedRequest).uid;

    const query = PaginationQuerySchema.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: "Invalid pagination parameters" });
      return;
    }

    const { limit, cursor } = query.data;
    const db = getFirestore();

    // 1. Fetch ALL followee IDs (no limit here – only the `in` clause is capped at 30)
    const followingSnap = await db
      .collection("follows")
      .where("followerId", "==", uid)
      .get();

    const followeeIds = followingSnap.docs.map((d) => d.data().followeeId as string);

    if (followeeIds.length === 0) {
      res.json({ posts: [], nextCursor: null, hasMore: false });
      return;
    }

    // 2. Chunk followees into groups of 30 (Firestore `in` operator limit)
    const MAX_IN = 30;
    const chunks: string[][] = [];
    for (let i = 0; i < followeeIds.length; i += MAX_IN) {
      chunks.push(followeeIds.slice(i, i + MAX_IN));
    }

    // 3. Decode cursor – the ISO timestamp of the last seen post
    let cursorTimestamp: typeof Timestamp.prototype | null = null;
    if (cursor) {
      try {
        cursorTimestamp = Timestamp.fromDate(new Date(cursor));
      } catch {
        // malformed cursor – treat as first page
      }
    }

    // 4. Run all chunk queries in parallel, each filtering server-side
    const chunkSnaps = await Promise.all(
      chunks.map((chunk) => {
        const base = db
          .collection("posts")
          .where("authorId", "in", chunk)
          .orderBy("createdAt", "desc")
          .limit(limit + 1);

        if (cursorTimestamp) {
          return db
            .collection("posts")
            .where("authorId", "in", chunk)
            .where("createdAt", "<", cursorTimestamp)
            .orderBy("createdAt", "desc")
            .limit(limit + 1)
            .get();
        }

        return base.get();
      })
    );

    // 5. Merge all docs, de-duplicate, sort by createdAt desc, take limit + 1
    const seen = new Set<string>();
    const merged: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    for (const snap of chunkSnaps) {
      for (const doc of snap.docs) {
        if (!seen.has(doc.id)) {
          seen.add(doc.id);
          merged.push(doc);
        }
      }
    }

    merged.sort((a, b) => {
      const aTime = (a.data().createdAt as typeof Timestamp.prototype)?.toMillis() ?? 0;
      const bTime = (b.data().createdAt as typeof Timestamp.prototype)?.toMillis() ?? 0;
      return bTime - aTime;
    });

    const hasMore = merged.length > limit;
    const pageDocs = merged.slice(0, limit);

    // 6. Resolve like status for this page
    const postIds = pageDocs.map((d) => d.id);
    const likedPostIds = new Set<string>();

    if (postIds.length > 0) {
      for (let i = 0; i < postIds.length; i += 30) {
        const batchIds = postIds.slice(i, i + 30);
        const likesSnap = await db
          .collection("likes")
          .where("userId", "==", uid)
          .where("postId", "in", batchIds)
          .get();
        likesSnap.docs.forEach((doc) => likedPostIds.add(doc.data().postId as string));
      }
    }

    // 7. Shape response – nextCursor is the ISO timestamp of the last doc
    const posts = pageDocs.map((d) => {
      const data = d.data();
      const createdAt = data.createdAt?.toDate
        ? data.createdAt.toDate().toISOString()
        : (data.createdAt as string);
      return {
        id: d.id,
        authorId: data.authorId as string,
        authorUsername: data.authorUsername as string,
        authorDisplayName: data.authorDisplayName as string,
        authorAvatarUrl: (data.authorAvatarUrl as string | null) ?? null,
        content: data.content as string,
        likesCount: (data.likesCount as number) ?? 0,
        commentsCount: (data.commentsCount as number) ?? 0,
        likedByMe: likedPostIds.has(d.id),
        createdAt,
      };
    });

    const lastDoc = pageDocs[pageDocs.length - 1];
    const nextCursor =
      hasMore && lastDoc
        ? (lastDoc.data().createdAt?.toDate?.().toISOString() ?? null)
        : null;

    res.json({ posts, nextCursor, hasMore });
  }
);

export default router;
