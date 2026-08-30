import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Hermetic env for tests: these take precedence over `.env`, because
    // dotenv never overwrites variables already present on process.env.
    // Keeps the suite runnable on a fresh clone with no local .env file.
    env: {
      NODE_ENV: "test",
      PORT: "4000",
      FRONTEND_ORIGIN: "http://localhost:5173",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      DIRECT_URL: "postgresql://test:test@localhost:5432/test",
    },
  },
});
