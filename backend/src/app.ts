import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";

import apiRouter from "./api/router.js";
import { errorHandler } from "./api/errors.js";
import { env } from "./config/env.js";

/**
 * Builds the Express app. Kept separate from the server bootstrap in
 * `index.ts` so tests can exercise the app without binding a port.
 */
export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      // Exact origin, not "*" - required for the session cookie to actually
      // be sent, since the frontend calls with credentials: 'include'.
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  // CSV import posts the raw file body (Content-Type: text/csv or text/plain),
  // not JSON - scoped to that one path so every other route keeps strict JSON.
  app.use("/api/v1/import", express.text({ type: ["text/csv", "text/plain"], limit: "2mb" }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.use("/api/v1", apiRouter);

  // Must be registered last: Express recognises an error handler by its
  // 4-argument arity.
  app.use(errorHandler);

  return app;
}
