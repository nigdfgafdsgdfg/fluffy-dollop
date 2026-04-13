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

    // 3. Decode cursor – format: "timestamp|docId"
    let cursorTimestamp: typeof Timestamp.prototype | null = null;
    let cursorDocId: string | null = null;

    if (cursor && cursor.includes("|")) {
      const [tsPart, idPart] = cursor.split("|");
      try {
        cursorTimestamp = Timestamp.fromDate(new Date(tsPart));
        cursorDocId = idPart;
      } catch {
        // malformed cursor – treat as first page
      }
    }

    // 4. Run all chunk queries in parallel, each filtering server-side
    // We use a composite sort [createdAt DESC, __name__ DESC] for deterministic merging.
    const chunkSnaps = await Promise.all(
      chunks.map((chunk) => {
        let q = db
          .collection("posts")
          .where("authorId", "in", chunk)
          .orderBy("createdAt", "desc")
          .orderBy("__name__", "desc")
          .limit(limit + 1);

        if (cursorTimestamp && cursorDocId) {
          // Use startAfter with both timestamp and docId for perfect continuity
          q = q.startAfter(cursorTimestamp, cursorDocId);
        }

        return q.get();
      })
    );

    // 5. Merge all docs, de-duplicate, sort by [createdAt DESC, docId DESC], take limit
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
      const aData = a.data();
      const bData = b.data();
      const aTime = (aData.createdAt as typeof Timestamp.prototype)?.toMillis() ?? 0;
      const bTime = (bData.createdAt as typeof Timestamp.prototype)?.toMillis() ?? 0;

      if (aTime !== bTime) {
        return bTime - aTime;
      }
      // Tie-break with doc ID for deterministic order
      return b.id.localeCompare(a.id);
    });

    const pageDocs = merged.slice(0, limit);
    const hasMore = merged.length > limit;

    // 6. Resolve like status for this page
    // ... rest of logic stays same ...
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

    // 7. Shape response
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
    let nextCursor: string | null = null;
    if (hasMore && lastDoc) {
      const lastTs = lastDoc.data().createdAt?.toDate?.().toISOString() ?? "";
      nextCursor = `${lastTs}|${lastDoc.id}`;
    }

    res.json({ posts, nextCursor, hasMore });
  }
);

export default router;
