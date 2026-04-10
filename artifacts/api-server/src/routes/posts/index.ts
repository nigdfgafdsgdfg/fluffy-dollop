import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { authenticate, type AuthenticatedRequest } from "../../middlewares/authenticate";
import { getFirestore, FieldValue, Timestamp } from "../../lib/firebase";

const router: IRouter = Router();

router.post("/posts", authenticate, async (req: Request, res: Response): Promise<void> => {
  const uid = (req as AuthenticatedRequest).uid;
  const db = getFirestore();

  const { content } = req.body as { content?: string };

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    res.status(400).json({ error: "Post content is required and must be non-empty" });
    return;
  }

  if (content.length > 280) {
    res.status(400).json({ error: "Post content must be 280 characters or fewer" });
    return;
  }

  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) {
    res.status(400).json({ error: "User profile not found. Create a profile first." });
    return;
  }

  const userData = userDoc.data()!;
  const now = Timestamp.now();

  const postRef = db.collection("posts").doc();
  const post = {
    id: postRef.id,
    authorId: uid,
    authorUsername: userData.username as string,
    authorDisplayName: userData.displayName as string,
    authorAvatarUrl: (userData.avatarUrl as string | null) ?? null,
    content: content.trim(),
    likesCount: 0,
    commentsCount: 0,
    createdAt: now,
  };

  const batch = db.batch();
  batch.set(postRef, post);
  batch.update(db.collection("users").doc(uid), {
    postsCount: FieldValue.increment(1),
  });
  await batch.commit();

  req.log.info({ postId: postRef.id, authorId: uid }, "Post created");

  res.status(201).json({
    ...post,
    createdAt: now.toDate().toISOString(),
  });
});

router.get("/posts/:postId", authenticate, async (req: Request, res: Response): Promise<void> => {
  const postId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
  const db = getFirestore();

  const postDoc = await db.collection("posts").doc(postId).get();

  if (!postDoc.exists) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  const data = postDoc.data()!;
  res.json({
    id: postDoc.id,
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
  });
});

router.delete(
  "/posts/:postId",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const uid = (req as AuthenticatedRequest).uid;
    const postId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
    const db = getFirestore();

    const postDoc = await db.collection("posts").doc(postId).get();

    if (!postDoc.exists) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    const data = postDoc.data()!;
    if (data.authorId !== uid) {
      res.status(403).json({ error: "You can only delete your own posts" });
      return;
    }

    const batch = db.batch();
    batch.delete(postDoc.ref);
    batch.update(db.collection("users").doc(uid), {
      postsCount: FieldValue.increment(-1),
    });
    await batch.commit();

    req.log.info({ postId, authorId: uid }, "Post deleted");
    res.sendStatus(204);
  }
);

export default router;
