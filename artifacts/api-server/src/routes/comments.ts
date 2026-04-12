import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { authenticate, type AuthenticatedRequest } from "../middlewares/authenticate";
import { writeLimiter } from "../middlewares/rateLimiter";
import { getFirestore, FieldValue, Timestamp } from "../lib/firebase";
import { z } from "zod";

const router: IRouter = Router();

const CreateCommentSchema = z.object({
  content: z.string().trim().min(1).max(500),
  imageUrl: z.string().max(600).nullable().optional().default(null),
  parentCommentId: z.string().max(128).nullable().optional().default(null),
});

const CommentParamsSchema = z.object({
  postId: z.string().min(1).max(128),
});

const CommentDeleteParamsSchema = z.object({
  postId: z.string().min(1).max(128),
  commentId: z.string().min(1).max(128),
});

const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().max(200).optional(),
});

router.get(
  "/posts/:postId/comments",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const params = CommentParamsSchema.safeParse(req.params);
    if (!params.success) { res.status(400).json({ error: "Invalid post ID" }); return; }

    const query = PaginationSchema.safeParse(req.query);
    const { limit } = query.success ? query.data : { limit: 50 };

    const db = getFirestore();
    const postDoc = await db.collection("posts").doc(params.data.postId).get();
    if (!postDoc.exists) { res.status(404).json({ error: "Post not found" }); return; }

    const commentsSnap = await db
      .collection("posts")
      .doc(params.data.postId)
      .collection("comments")
      .orderBy("createdAt", "asc")
      .limit(limit)
      .get();

    const comments = commentsSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        postId: params.data.postId,
        parentCommentId: (d.parentCommentId as string | null) ?? null,
        authorId: d.authorId as string,
        authorUsername: d.authorUsername as string,
        authorDisplayName: d.authorDisplayName as string,
        authorAvatarUrl: (d.authorAvatarUrl as string | null) ?? null,
        content: d.content as string,
        imageUrl: (d.imageUrl as string | null) ?? null,
        repliesCount: (d.repliesCount as number) ?? 0,
        createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : d.createdAt,
      };
    });

    res.json({ comments, nextCursor: null, hasMore: false });
  }
);

router.post(
  "/posts/:postId/comments",
  writeLimiter,
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const uid = (req as AuthenticatedRequest).uid;
    const params = CommentParamsSchema.safeParse(req.params);
    if (!params.success) { res.status(400).json({ error: "Invalid post ID" }); return; }

    const parsed = CreateCommentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors.map(e => e.message).join("; ") });
      return;
    }

    const db = getFirestore();
    const postDoc = await db.collection("posts").doc(params.data.postId).get();
    if (!postDoc.exists) { res.status(404).json({ error: "Post not found" }); return; }

    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) { res.status(400).json({ error: "User profile not found" }); return; }

    const { content, imageUrl, parentCommentId } = parsed.data;
    const userData = userDoc.data()!;
    const now = Timestamp.now();

    const commentsRef = db.collection("posts").doc(params.data.postId).collection("comments");
    const commentRef = commentsRef.doc();

    const comment = {
      id: commentRef.id,
      postId: params.data.postId,
      parentCommentId: parentCommentId ?? null,
      authorId: uid,
      authorUsername: userData.username as string,
      authorDisplayName: userData.displayName as string,
      authorAvatarUrl: (userData.avatarUrl as string | null) ?? null,
      content,
      imageUrl: imageUrl ?? null,
      repliesCount: 0,
      createdAt: now,
    };

    const batch = db.batch();
    batch.set(commentRef, comment);
    batch.update(db.collection("posts").doc(params.data.postId), {
      commentsCount: FieldValue.increment(1),
    });

    if (parentCommentId) {
      const parentRef = commentsRef.doc(parentCommentId);
      batch.update(parentRef, { repliesCount: FieldValue.increment(1) });
    }

    await batch.commit();

    res.status(201).json({
      ...comment,
      createdAt: now.toDate().toISOString(),
    });
  }
);

router.delete(
  "/posts/:postId/comments/:commentId",
  writeLimiter,
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const uid = (req as AuthenticatedRequest).uid;
    const params = CommentDeleteParamsSchema.safeParse(req.params);
    if (!params.success) { res.status(400).json({ error: "Invalid params" }); return; }

    const db = getFirestore();
    const commentRef = db
      .collection("posts")
      .doc(params.data.postId)
      .collection("comments")
      .doc(params.data.commentId);

    const commentDoc = await commentRef.get();
    if (!commentDoc.exists) { res.status(404).json({ error: "Comment not found" }); return; }

    const data = commentDoc.data()!;
    if (data.authorId !== uid) { res.status(403).json({ error: "Forbidden" }); return; }

    const batch = db.batch();
    batch.delete(commentRef);
    batch.update(db.collection("posts").doc(params.data.postId), {
      commentsCount: FieldValue.increment(-1),
    });

    if (data.parentCommentId) {
      const parentRef = db
        .collection("posts")
        .doc(params.data.postId)
        .collection("comments")
        .doc(data.parentCommentId);
      batch.update(parentRef, { repliesCount: FieldValue.increment(-1) });
    }

    await batch.commit();
    res.sendStatus(204);
  }
);

export default router;
