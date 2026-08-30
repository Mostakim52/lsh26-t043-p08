import type { TeacherAccount } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      /** Populated by `requireAuth` once the session cookie is resolved. */
      teacher?: TeacherAccount;
    }
  }
}

export {};
