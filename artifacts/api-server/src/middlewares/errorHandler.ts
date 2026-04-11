import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

const isProduction = process.env.NODE_ENV === "production";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    const messages = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    req.log.warn({ errors: err.errors }, "Validation error");
    res.status(400).json({ error: messages });
    return;
  }

  const httpErr = err as { status?: number; statusCode?: number; type?: string; message?: string };
  const status = httpErr.status ?? httpErr.statusCode;

  if (status === 413 || httpErr.type === "entity.too.large") {
    res.status(413).json({ error: "Request body too large" });
    return;
  }

  if (status === 400 && httpErr.type === "entity.parse.failed") {
    res.status(400).json({ error: "Invalid JSON in request body" });
    return;
  }

  if (status && status >= 400 && status < 500) {
    res.status(status).json({ error: httpErr.message ?? "Bad request" });
    return;
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  req.log.error({ err }, "Unhandled error");

  res.status(500).json({
    error: isProduction ? "Internal server error" : message,
  });
}
