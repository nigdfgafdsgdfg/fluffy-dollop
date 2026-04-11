import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { authenticate, type AuthenticatedRequest } from "../../middlewares/authenticate";
import { getFirestore } from "../../lib/firebase";
import { PaginationQuerySchema } from "../../lib/validation";

const router: IRouter = Router();

/**
 * Feed strategy: fan-out on read.
 *
 * Fetches all posts from followed users, sorts in memory, then paginates.
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

    const followingSnap = await db
      .collection("follows")
      .where("followerId", "==", uid)
      .get();

    const followeeIds = followingSnap.docs.map((d) => d.data().followeeId as string);

    if (followeeIds.length === 0) {
      res.json({ posts: [], nextCursor: null, hasMore: false });
      return;
    }

    const MAX_IN_CLAUSE = 30;
    const batch = followeeIds.slice(0, MAX_IN_CLAUSE);

    const snap = await db
      .collection("posts")
      .where("authorId", "in", batch)
      .get();

    const allDocs = snap.docs.sort((a, b) => {
      const aTime = a.data().createdAt?.toMillis?.() ?? 0;
      const bTime = b.data().createdAt?.toMillis?.() ?? 0;
      return bTime - aTime;
    });

    let startIdx = 0;
    if (cursor) {
      const cursorIdx = allDocs.findIndex((d) => d.id === cursor);
      if (cursorIdx !== -1) startIdx = cursorIdx + 1;
    }

    const pageDocs = allDocs.slice(startIdx, startIdx + limit);
    const hasMore = startIdx + limit < allDocs.length;

    const posts = pageDocs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        authorId: data.authorId as string,
        authorUsername: data.authorUsername as string,
        authorDisplayName: data.authorDisplayName as string,
        authorAvatarUrl: (data.authorAvatarUrl as string | null) ?? null,
        content: data.content as string,
        likesCount: (data.likesCount as number) ?? 0,
        commentsCount: (data.commentsCount as number) ?? 0,
        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate().toISOString()
          : data.createdAt,
      };
    });

    res.json({
      posts,
      nextCursor: hasMore ? pageDocs[pageDocs.length - 1].id : null,
      hasMore,
    });
  }
);

export default router;
