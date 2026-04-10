import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { authenticate, type AuthenticatedRequest } from "../../middlewares/authenticate";
import { getFirestore, FieldValue, Timestamp } from "../../lib/firebase";

const router: IRouter = Router();

router.post(
  "/follows/:targetUserId",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const uid = (req as AuthenticatedRequest).uid;
    const targetUserId = Array.isArray(req.params.targetUserId)
      ? req.params.targetUserId[0]
      : req.params.targetUserId;
    const db = getFirestore();

    if (uid === targetUserId) {
      res.status(400).json({ error: "You cannot follow yourself" });
      return;
    }

    const targetUserDoc = await db.collection("users").doc(targetUserId).get();
    if (!targetUserDoc.exists) {
      res.status(404).json({ error: "Target user not found" });
      return;
    }

    const followId = `${uid}_${targetUserId}`;
    const followRef = db.collection("follows").doc(followId);
    const existing = await followRef.get();

    if (existing.exists) {
      res.status(409).json({ error: "Already following this user" });
      return;
    }

    const now = Timestamp.now();
    const batch = db.batch();

    batch.set(followRef, {
      followId,
      followerId: uid,
      followeeId: targetUserId,
      createdAt: now,
    });

    batch.update(db.collection("users").doc(uid), {
      followingCount: FieldValue.increment(1),
    });

    batch.update(db.collection("users").doc(targetUserId), {
      followersCount: FieldValue.increment(1),
    });

    await batch.commit();

    req.log.info({ followerId: uid, followeeId: targetUserId }, "User followed");
    res.json({ following: true, targetUserId });
  }
);

router.delete(
  "/follows/:targetUserId",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const uid = (req as AuthenticatedRequest).uid;
    const targetUserId = Array.isArray(req.params.targetUserId)
      ? req.params.targetUserId[0]
      : req.params.targetUserId;
    const db = getFirestore();

    const followId = `${uid}_${targetUserId}`;
    const followRef = db.collection("follows").doc(followId);
    const existing = await followRef.get();

    if (!existing.exists) {
      res.status(400).json({ error: "You are not following this user" });
      return;
    }

    const batch = db.batch();

    batch.delete(followRef);

    batch.update(db.collection("users").doc(uid), {
      followingCount: FieldValue.increment(-1),
    });

    batch.update(db.collection("users").doc(targetUserId), {
      followersCount: FieldValue.increment(-1),
    });

    await batch.commit();

    req.log.info({ followerId: uid, followeeId: targetUserId }, "User unfollowed");
    res.json({ following: false, targetUserId });
  }
);

export default router;
