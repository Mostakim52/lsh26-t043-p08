import { config } from "dotenv";
import { z } from "zod";

config();

/**
 * Every environment variable the server depends on, validated once at boot.
 * A missing or malformed value fails fast here rather than surfacing as a
 * confusing runtime error deep inside a request handler.
 */
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:5173"),

  /** Pooled connection (Supabase Postgres), used by the running server. */
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  /** Direct connection, used by `prisma migrate` only. */
  DIRECT_URL: z.string().min(1).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(
    `Invalid environment configuration:\n${issues}\n\nCopy .env.example to .env and fill in the values.`,
  );
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === "production";
