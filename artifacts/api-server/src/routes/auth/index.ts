import { Router, type IRouter } from "express";
import { authenticate, type AuthenticatedRequest } from "../../middlewares/authenticate";
import { getFirestore } from "../../lib/firebase";
import type { Request, Response } from "express";

const router: IRouter = Router();

router.get("/auth/me", authenticate, async (req: Request, res: Response): Promise<void> => {
  const uid = (req as AuthenticatedRequest).uid;
  const db = getFirestore();

  const userDoc = await db.collection("users").doc(uid).get();

  if (!userDoc.exists) {
    res.status(404).json({ error: "User profile not found" });
    return;
  }

  res.json({ uid, ...userDoc.data() });
});

export default router;
