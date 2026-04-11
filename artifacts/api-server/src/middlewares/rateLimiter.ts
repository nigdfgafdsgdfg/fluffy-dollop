import rateLimit from "express-rate-limit";

const isProduction = process.env.NODE_ENV === "production";

/** General API rate limit — 100 requests per minute per IP */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: () => !isProduction,
  message: { error: "Too many requests, please slow down." },
});

/** Stricter limit for write operations — 20 per minute per IP */
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: () => !isProduction,
  message: { error: "Too many write requests, please slow down." },
});

/** Auth token verification — 30 per minute per IP */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: () => !isProduction,
  message: { error: "Too many authentication attempts, please slow down." },
});
