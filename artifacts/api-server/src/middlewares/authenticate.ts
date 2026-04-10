import type { Request, Response, NextFunction } from "express";
import { getAuth } from "../lib/firebase";

export interface AuthenticatedRequest extends Request {
  uid: string;
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    (req as AuthenticatedRequest).uid = decoded.uid;
    next();
  } catch {
    req.log.warn("Invalid Firebase ID token");
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
