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

  const idToken = authHeader.slice(7).trim();

  if (!idToken) {
    req.log.warn("Missing Bearer token in Authorization header");
    res.status(401).json({ error: "Missing Bearer token" });
    return;
  }

  try {
    req.log.debug({ tokenPrefix: idToken.slice(0, 10) }, "Attempting to verify Firebase ID token");
    const decoded = await getAuth().verifyIdToken(idToken, true);
    (req as AuthenticatedRequest).uid = decoded.uid;
    next();
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    const message = (err as Error).message;
    if (code === "auth/id-token-revoked") {
      req.log.warn("Revoked Firebase ID token used");
      res.status(401).json({ error: "Token has been revoked. Please sign in again." });
    } else if (code === "auth/id-token-expired") {
      res.status(401).json({ error: "Token has expired. Please sign in again." });
    } else {
      req.log.warn({ code, message, tokenPrefix: idToken.slice(0, 10) }, "Invalid Firebase ID token");
      res.status(401).json({ error: `Invalid or expired token: ${code}` });
    }
  }
}
