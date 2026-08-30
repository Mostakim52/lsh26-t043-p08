-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProfileRole" AS ENUM ('TEACHER', 'STUDENT');

-- CreateTable
CREATE TABLE "exam_sessions" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hasPractical" BOOLEAN NOT NULL,
    "isCompulsory" BOOLEAN NOT NULL,
    "displayOrder" INTEGER NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "rollNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "optionalSubjectId" TEXT NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_marks" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "isAbsent" BOOLEAN NOT NULL DEFAULT false,
    "wholeScore" INTEGER,
    "theoryScore" INTEGER,
    "practicalScore" INTEGER,

    CONSTRAINT "student_marks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "ProfileRole" NOT NULL,
    "studentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exam_sessions_caseId_key" ON "exam_sessions"("caseId");

-- CreateIndex
CREATE INDEX "subjects_sessionId_idx" ON "subjects"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_sessionId_code_key" ON "subjects"("sessionId", "code");

-- CreateIndex
CREATE INDEX "students_sessionId_idx" ON "students"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "students_sessionId_rollNo_key" ON "students"("sessionId", "rollNo");

-- CreateIndex
CREATE INDEX "student_marks_studentId_idx" ON "student_marks"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "student_marks_studentId_subjectId_key" ON "student_marks"("studentId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_studentId_key" ON "profiles"("studentId");

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "exam_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "exam_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_optionalSubjectId_fkey" FOREIGN KEY ("optionalSubjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_marks" ADD CONSTRAINT "student_marks_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_marks" ADD CONSTRAINT "student_marks_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- CheckConstraint: a mark is exactly one of absent / whole-paper / theory+practical.
-- Keeps "absent" from ever collapsing into "scored zero" at the storage layer,
-- and holds each component inside the bounds the problem statement defines.
ALTER TABLE "student_marks" ADD CONSTRAINT "student_marks_shape_check" CHECK (
    (
        "isAbsent" = true
        AND "wholeScore" IS NULL
        AND "theoryScore" IS NULL
        AND "practicalScore" IS NULL
    )
    OR (
        "isAbsent" = false
        AND "wholeScore" IS NOT NULL AND "wholeScore" BETWEEN 0 AND 100
        AND "theoryScore" IS NULL
        AND "practicalScore" IS NULL
    )
    OR (
        "isAbsent" = false
        AND "wholeScore" IS NULL
        AND "theoryScore" IS NOT NULL AND "theoryScore" BETWEEN 0 AND 75
        AND "practicalScore" IS NOT NULL AND "practicalScore" BETWEEN 0 AND 25
    )
);
