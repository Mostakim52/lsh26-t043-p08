import type { NextFunction, Request, Response } from "express";

/**
 * Error envelope per the frontend's documented contract:
 *   { "error": { "code": "...", "message": "..." } }
 */
export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Last middleware in the chain (4-arg signature, required by Express to be
 * recognised as an error handler). ApiErrors surface their own status/code/
 * message; anything else is logged server-side and reported generically so
 * internal details (Prisma errors, stack traces) never reach the client.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    return;
  }
  console.error("[unhandled]", err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
}
