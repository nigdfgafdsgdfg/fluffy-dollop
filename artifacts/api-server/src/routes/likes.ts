import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { authenticate, type AuthenticatedRequest } from "../middlewares/authenticate";
import { writeLimiter } from "../middlewares/rateLimiter";
import { getFirestore, FieldValue, Timestamp } from "../lib/firebase";
import { PostIdParamSchema } from "../lib/validation";

const router: IRouter = Router();

router.post(
  "/posts/:postId/like",
  writeLimiter,
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const uid = (req as AuthenticatedRequest).uid;

    const params = PostIdParamSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid post ID" });
      return;
    }

    const { postId } = params.data;
    const db = getFirestore();

    const postRef = db.collection("posts").doc(postId);
    const postDoc = await postRef.get();

    if (!postDoc.exists) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    const likeId = `${uid}_${postId}`;
    const likeRef = db.collection("likes").doc(likeId);
    const existing = await likeRef.get();

    if (existing.exists) {
      res.status(409).json({ error: "Already liked this post" });
      return;
    }

    const now = Timestamp.now();
    const batch = db.batch();

    batch.set(likeRef, { likeId, userId: uid, postId, createdAt: now });
    batch.update(postRef, { likesCount: FieldValue.increment(1) });

    await batch.commit();

    const updatedPost = await postRef.get();
    const likesCount = (updatedPost.data()?.likesCount as number) ?? 1;

    req.log.info({ userId: uid, postId }, "Post liked");
    res.json({ liked: true, postId, likesCount });
  }
);

router.delete(
  "/posts/:postId/like",
  writeLimiter,
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const uid = (req as AuthenticatedRequest).uid;

    const params = PostIdParamSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid post ID" });
      return;
    }

    const { postId } = params.data;
    const db = getFirestore();

    const postRef = db.collection("posts").doc(postId);
    const postDoc = await postRef.get();

    if (!postDoc.exists) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    const likeId = `${uid}_${postId}`;
    const likeRef = db.collection("likes").doc(likeId);
    const existing = await likeRef.get();

    if (!existing.exists) {
      res.status(400).json({ error: "You have not liked this post" });
      return;
    }

    const batch = db.batch();
    batch.delete(likeRef);
    batch.update(postRef, { likesCount: FieldValue.increment(-1) });

    await batch.commit();

    const updatedPost = await postRef.get();
    const likesCount = Math.max(0, (updatedPost.data()?.likesCount as number) ?? 0);

    req.log.info({ userId: uid, postId }, "Post unliked");
    res.json({ liked: false, postId, likesCount });
  }
);

export default router;
