import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { authenticate, type AuthenticatedRequest } from "../../middlewares/authenticate";
import { getFirestore, FieldValue, Timestamp } from "../../lib/firebase";

const router: IRouter = Router();

router.post("/users", authenticate, async (req: Request, res: Response): Promise<void> => {
  const uid = (req as AuthenticatedRequest).uid;
  const db = getFirestore();

  const { username, displayName, bio = null, avatarUrl = null } = req.body as {
    username?: string;
    displayName?: string;
    bio?: string | null;
    avatarUrl?: string | null;
  };

  if (!username || !displayName) {
    res.status(400).json({ error: "username and displayName are required" });
    return;
  }

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
    username,
    displayName,
    bio,
    avatarUrl,
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
});

router.get("/users/:userId", authenticate, async (req: Request, res: Response): Promise<void> => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const db = getFirestore();

  const userDoc = await db.collection("users").doc(userId).get();

  if (!userDoc.exists) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const data = userDoc.data()!;
  res.json({
    ...data,
    createdAt:
      data.createdAt?.toDate
        ? data.createdAt.toDate().toISOString()
        : data.createdAt,
  });
});

router.get(
  "/users/:userId/followers",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    const db = getFirestore();

    const followersSnap = await db
      .collection("follows")
      .where("followeeId", "==", userId)
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
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    const db = getFirestore();

    const followingSnap = await db
      .collection("follows")
      .where("followerId", "==", userId)
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
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    const db = getFirestore();
    const limit = Math.min(parseInt((req.query.limit as string) ?? "20", 10), 100);
    const cursor = req.query.cursor as string | undefined;

    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const snap = await db
      .collection("posts")
      .where("authorId", "==", userId)
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

    const nextCursor = hasMore ? pageDocs[pageDocs.length - 1].id : null;

    res.json({ posts, nextCursor, hasMore });
  }
);

export default router;
