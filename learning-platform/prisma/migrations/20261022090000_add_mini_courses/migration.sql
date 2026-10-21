-- CreateEnum
CREATE TYPE "MiniCourseStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "MiniCourseLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "LearnerBackground" AS ENUM ('BEGINNER', 'EXPERIENCED');

-- CreateEnum
CREATE TYPE "MiniCourseBlockType" AS ENUM ('HEADING', 'TEXT', 'IMAGE', 'VIDEO', 'FILE', 'ACTIVITY', 'SUMMARY');

-- CreateTable
CREATE TABLE "MiniCourse" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "audience" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL DEFAULT '',
    "objectives" JSONB NOT NULL DEFAULT '[]',
    "resources" JSONB NOT NULL DEFAULT '[]',
    "level" "MiniCourseLevel" NOT NULL DEFAULT 'BEGINNER',
    "background" "LearnerBackground" NOT NULL DEFAULT 'EXPERIENCED',
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "language" TEXT NOT NULL DEFAULT 'en',
    "status" "MiniCourseStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MiniCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiniCourseChapter" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "objectives" JSONB NOT NULL DEFAULT '[]',
    "resources" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MiniCourseChapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiniCourseBlock" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "type" "MiniCourseBlockType" NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MiniCourseBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiniCourseAiUsage" (
    "id" TEXT NOT NULL,
    "courseId" TEXT,
    "userId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "durationMs" INTEGER,
    "errorDetail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MiniCourseAiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MiniCourse_ownerId_updatedAt_idx" ON "MiniCourse"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "MiniCourse_ownerId_status_idx" ON "MiniCourse"("ownerId", "status");

-- CreateIndex
CREATE INDEX "MiniCourseChapter_courseId_idx" ON "MiniCourseChapter"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "MiniCourseChapter_courseId_ordinal_key" ON "MiniCourseChapter"("courseId", "ordinal");

-- CreateIndex
CREATE INDEX "MiniCourseBlock_chapterId_idx" ON "MiniCourseBlock"("chapterId");

-- CreateIndex
CREATE UNIQUE INDEX "MiniCourseBlock_chapterId_ordinal_key" ON "MiniCourseBlock"("chapterId", "ordinal");

-- CreateIndex
CREATE INDEX "MiniCourseAiUsage_courseId_createdAt_idx" ON "MiniCourseAiUsage"("courseId", "createdAt");

-- CreateIndex
CREATE INDEX "MiniCourseAiUsage_userId_createdAt_idx" ON "MiniCourseAiUsage"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "MiniCourse" ADD CONSTRAINT "MiniCourse_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiniCourseChapter" ADD CONSTRAINT "MiniCourseChapter_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "MiniCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiniCourseBlock" ADD CONSTRAINT "MiniCourseBlock_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "MiniCourseChapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiniCourseAiUsage" ADD CONSTRAINT "MiniCourseAiUsage_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "MiniCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiniCourseAiUsage" ADD CONSTRAINT "MiniCourseAiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
