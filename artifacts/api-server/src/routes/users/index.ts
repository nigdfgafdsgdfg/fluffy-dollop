import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { authenticate, type AuthenticatedRequest } from "../../middlewares/authenticate";
import { writeLimiter } from "../../middlewares/rateLimiter";
import { getFirestore, FieldValue, Timestamp } from "../../lib/firebase";
import {
  CreateUserProfileSchema,
  PaginationQuerySchema,
  UserIdParamSchema,
} from "../../lib/validation";

const router: IRouter = Router();

router.post(
  "/users",
  writeLimiter,
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const uid = (req as AuthenticatedRequest).uid;
    const db = getFirestore();

    const parsed = CreateUserProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      const messages = parsed.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      res.status(400).json({ error: messages });
      return;
    }

    const { username, displayName, bio, avatarUrl } = parsed.data;

    const userRef = db.collection("users").doc(uid);
    const existing = await userRef.get();
    if (existing.exists) {
      res.status(409).json({ error: "User profile already exists" });
      return;
    }

    const usernameRef = db.collection("usernames").doc(username.toLowerCase());
    const usernameDoc = await usernameRef.get();
    if (usernameDoc.exists) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }

    const now = Timestamp.now();
    const userProfile = {
      uid,
      username: username.toLowerCase(),
      displayName,
      bio: bio ?? null,
      avatarUrl: avatarUrl ?? null,
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      createdAt: now,
    };

    const batch = db.batch();
    batch.set(userRef, userProfile);
    batch.set(usernameRef, { uid });
    await batch.commit();

    req.log.info({ uid, username }, "User profile created");

    res.status(201).json({
      ...userProfile,
      createdAt: now.toDate().toISOString(),
    });
  }
);

router.get(
  "/users/:userId",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const params = UserIdParamSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid user ID" });
      return;
    }

    const db = getFirestore();
    const userDoc = await db.collection("users").doc(params.data.userId).get();

    if (!userDoc.exists) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const data = userDoc.data()!;
    res.json({
      uid: data.uid,
      username: data.username,
      displayName: data.displayName,
      bio: data.bio ?? null,
      avatarUrl: data.avatarUrl ?? null,
      followersCount: data.followersCount ?? 0,
      followingCount: data.followingCount ?? 0,
      postsCount: data.postsCount ?? 0,
      createdAt: data.createdAt?.toDate
        ? data.createdAt.toDate().toISOString()
        : data.createdAt,
    });
  }
);

router.get(
  "/users/:userId/followers",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const params = UserIdParamSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid user ID" });
      return;
    }

    const db = getFirestore();
    const followersSnap = await db
      .collection("follows")
      .where("followeeId", "==", params.data.userId)
      .get();

    const followerUids = followersSnap.docs.map((d) => d.data().followerId as string);

    if (followerUids.length === 0) {
      res.json({ users: [] });
      return;
    }

    const userDocs = await Promise.all(
      followerUids.map((uid) => db.collection("users").doc(uid).get())
    );

    const users = userDocs
      .filter((d) => d.exists)
      .map((d) => {
        const data = d.data()!;
        return {
          uid: data.uid as string,
          username: data.username as string,
          displayName: data.displayName as string,
          avatarUrl: (data.avatarUrl as string | null) ?? null,
        };
      });

    res.json({ users });
  }
);

router.get(
  "/users/:userId/following",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const params = UserIdParamSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid user ID" });
      return;
    }

    const db = getFirestore();
    const followingSnap = await db
      .collection("follows")
      .where("followerId", "==", params.data.userId)
      .get();

    const followeeUids = followingSnap.docs.map((d) => d.data().followeeId as string);

    if (followeeUids.length === 0) {
      res.json({ users: [] });
      return;
    }

    const userDocs = await Promise.all(
      followeeUids.map((uid) => db.collection("users").doc(uid).get())
    );

    const users = userDocs
      .filter((d) => d.exists)
      .map((d) => {
        const data = d.data()!;
        return {
          uid: data.uid as string,
          username: data.username as string,
          displayName: data.displayName as string,
          avatarUrl: (data.avatarUrl as string | null) ?? null,
        };
      });

    res.json({ users });
  }
);

router.get(
  "/users/:userId/posts",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const params = UserIdParamSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid user ID" });
      return;
    }

    const query = PaginationQuerySchema.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: "Invalid pagination parameters" });
      return;
    }

    const { limit, cursor } = query.data;
    const db = getFirestore();

    const userDoc = await db.collection("users").doc(params.data.userId).get();
    if (!userDoc.exists) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const snap = await db
      .collection("posts")
      .where("authorId", "==", params.data.userId)
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

    res.json({ posts, nextCursor: hasMore ? pageDocs[pageDocs.length - 1].id : null, hasMore });
  }
);

export default router;
