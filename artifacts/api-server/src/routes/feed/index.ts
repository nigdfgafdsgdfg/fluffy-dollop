import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { authenticate, type AuthenticatedRequest } from "../../middlewares/authenticate";
import { getFirestore } from "../../lib/firebase";

const router: IRouter = Router();

/**
 * Feed strategy: fan-out on read.
 *
 * For the basic implementation, we fetch the list of users the current user
 * follows, then query posts authored by those users ordered by createdAt desc.
 * This approach works well for users who follow a modest number of accounts
 * (< 1000).
 *
 * For high-scale production, replace this with a fan-out-on-write pattern
 * using a Cloud Function that pushes new posts to follower feed documents in
 * a `feeds/{userId}/posts` sub-collection. The endpoint signature stays the same.
 */
router.get("/feed", authenticate, async (req: Request, res: Response): Promise<void> => {
  const uid = (req as AuthenticatedRequest).uid;
  const db = getFirestore();
  const limit = Math.min(parseInt((req.query.limit as string) ?? "20", 10), 100);
  const cursor = req.query.cursor as string | undefined;

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

  let query = db
    .collection("posts")
    .where("authorId", "in", batch)
    .orderBy("createdAt", "desc")
    .limit(limit + 1);

  if (cursor) {
    const cursorDoc = await db.collection("posts").doc(cursor).get();
    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc);
    }
  }

  const snap = await query.get();
  const docs = snap.docs;
  const hasMore = docs.length > limit;
  const pageDocs = hasMore ? docs.slice(0, limit) : docs;

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

  const nextCursor = hasMore ? pageDocs[pageDocs.length - 1].id : null;

  res.json({ posts, nextCursor, hasMore });
});

export default router;
