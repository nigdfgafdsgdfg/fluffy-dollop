import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { authenticate, type AuthenticatedRequest } from "../../middlewares/authenticate";
import { writeLimiter } from "../../middlewares/rateLimiter";
import { getFirestore, FieldValue, Timestamp } from "../../lib/firebase";
import { PostIdParamSchema, PaginationQuerySchema, UserIdParamSchema } from "../../lib/validation";
import { z } from "zod";

const CreatePostSchema = z.object({
  content: z.string().trim().max(280, "Post content must be 280 characters or fewer").default(""),
  imageUrl: z.string().max(600).nullable().optional().default(null),
}).refine((data) => data.content.length > 0 || data.imageUrl != null, {
  message: "Post must have text or an image",
});

const router: IRouter = Router();

router.post(
  "/posts",
  writeLimiter,
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const uid = (req as AuthenticatedRequest).uid;
    const db = getFirestore();

    const parsed = CreatePostSchema.safeParse(req.body);
    if (!parsed.success) {
      const messages = parsed.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      res.status(400).json({ error: messages });
      return;
    }

    const { content, imageUrl } = parsed.data;

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
      content,
      imageUrl: imageUrl ?? null,
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
  }
);

router.get(
  "/posts/:postId",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const uid = (req as AuthenticatedRequest).uid;
    const params = PostIdParamSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid post ID" });
      return;
    }

    const db = getFirestore();
    const postDoc = await db.collection("posts").doc(params.data.postId).get();

    if (!postDoc.exists) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    const likeDoc = await db.collection("likes").doc(`${uid}_${postDoc.id}`).get();

    const data = postDoc.data()!;
    res.json({
      id: postDoc.id,
      authorId: data.authorId as string,
      authorUsername: data.authorUsername as string,
      authorDisplayName: data.authorDisplayName as string,
      authorAvatarUrl: (data.authorAvatarUrl as string | null) ?? null,
      content: data.content as string,
      imageUrl: (data.imageUrl as string | null) ?? null,
      likesCount: (data.likesCount as number) ?? 0,
      commentsCount: (data.commentsCount as number) ?? 0,
      likedByMe: likeDoc.exists,
      createdAt: data.createdAt?.toDate
        ? data.createdAt.toDate().toISOString()
        : data.createdAt,
    });
  }
);

router.delete(
  "/posts/:postId",
  writeLimiter,
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const uid = (req as AuthenticatedRequest).uid;

    const params = PostIdParamSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid post ID" });
      return;
    }

    const db = getFirestore();
    const postDoc = await db.collection("posts").doc(params.data.postId).get();

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

    req.log.info({ postId: params.data.postId, authorId: uid }, "Post deleted");
    res.sendStatus(204);
  }
);

export default router;
