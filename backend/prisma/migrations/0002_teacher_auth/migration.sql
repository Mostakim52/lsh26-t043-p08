-- DropForeignKey
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_studentId_fkey";

-- AlterTable
ALTER TABLE "exam_sessions" DROP COLUMN "isPublished",
DROP COLUMN "publishedAt";

-- DropTable
DROP TABLE "profiles";

-- DropEnum
DROP TYPE "ProfileRole";

-- CreateTable
CREATE TABLE "teacher_accounts" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "tokenHash" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateIndex
CREATE UNIQUE INDEX "teacher_accounts_username_key" ON "teacher_accounts"("username");

-- CreateIndex
CREATE INDEX "auth_sessions_teacherId_idx" ON "auth_sessions"("teacherId");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teacher_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

