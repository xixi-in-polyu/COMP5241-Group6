-- Expand the existing Course model first. Legacy MiniCourse tables remain in
-- place for one release so the cut-over can be verified and rolled back.

ALTER TYPE "MaterialStatus" ADD VALUE IF NOT EXISTS 'UPLOADING';
ALTER TYPE "MaterialStatus" ADD VALUE IF NOT EXISTS 'DOWNLOAD_ONLY';

CREATE TYPE "CoursePublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED');
CREATE TYPE "CourseMaterialKind" AS ENUM ('FILE', 'TEXT');
CREATE TYPE "CourseResourceKind" AS ENUM ('LINK', 'VIDEO', 'FILE');

ALTER TABLE "Course" ALTER COLUMN "teacherId" DROP NOT NULL;
ALTER TABLE "Course"
  ADD COLUMN "ownerId" TEXT,
  ADD COLUMN "subject" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "audience" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "objectives" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "level" "MiniCourseLevel" NOT NULL DEFAULT 'BEGINNER',
  ADD COLUMN "background" "LearnerBackground" NOT NULL DEFAULT 'EXPERIENCED',
  ADD COLUMN "durationMinutes" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN "publicationStatus" "CoursePublicationStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "shareTokenHash" TEXT,
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "legacyMiniCourseId" TEXT,
  ADD COLUMN "knowledgeStale" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "aiSelectionConfirmed" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Course"
SET "ownerId" = "teacherId",
    "subject" = COALESCE("category", '')
WHERE "ownerId" IS NULL;

CREATE UNIQUE INDEX "Course_shareTokenHash_key" ON "Course"("shareTokenHash");
CREATE UNIQUE INDEX "Course_legacyMiniCourseId_key" ON "Course"("legacyMiniCourseId");
CREATE INDEX "Course_ownerId_archivedAt_updatedAt_idx" ON "Course"("ownerId", "archivedAt", "updatedAt");
CREATE INDEX "Course_ownerId_publicationStatus_idx" ON "Course"("ownerId", "publicationStatus");
ALTER TABLE "Course" ADD CONSTRAINT "Course_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CourseChapter" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "objectives" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseChapter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseBlock" (
  "id" TEXT NOT NULL,
  "chapterId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "type" "MiniCourseBlockType" NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseBlock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseResource" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "chapterId" TEXT,
  "kind" "CourseResourceKind" NOT NULL,
  "title" TEXT NOT NULL DEFAULT '',
  "url" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseResource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseChapter_courseId_ordinal_key" ON "CourseChapter"("courseId", "ordinal");
CREATE INDEX "CourseChapter_courseId_idx" ON "CourseChapter"("courseId");
CREATE UNIQUE INDEX "CourseBlock_chapterId_ordinal_key" ON "CourseBlock"("chapterId", "ordinal");
CREATE INDEX "CourseBlock_chapterId_idx" ON "CourseBlock"("chapterId");
CREATE UNIQUE INDEX "CourseResource_courseId_chapterId_ordinal_key" ON "CourseResource"("courseId", "chapterId", "ordinal");
CREATE INDEX "CourseResource_courseId_chapterId_idx" ON "CourseResource"("courseId", "chapterId");

ALTER TABLE "CourseChapter" ADD CONSTRAINT "CourseChapter_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseBlock" ADD CONSTRAINT "CourseBlock_chapterId_fkey"
  FOREIGN KEY ("chapterId") REFERENCES "CourseChapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseResource" ADD CONSTRAINT "CourseResource_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseResource" ADD CONSTRAINT "CourseResource_chapterId_fkey"
  FOREIGN KEY ("chapterId") REFERENCES "CourseChapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseMaterial"
  ALTER COLUMN "blobPathname" DROP NOT NULL,
  ADD COLUMN "chapterId" TEXT,
  ADD COLUMN "kind" "CourseMaterialKind" NOT NULL DEFAULT 'FILE',
  ADD COLUMN "textContent" TEXT,
  ADD COLUMN "aiSelected" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX "CourseMaterial_chapterId_idx" ON "CourseMaterial"("chapterId");
ALTER TABLE "CourseMaterial" ADD CONSTRAINT "CourseMaterial_chapterId_fkey"
  FOREIGN KEY ("chapterId") REFERENCES "CourseChapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseMaterial" ADD CONSTRAINT "CourseMaterial_storage_check" CHECK (
  ("kind" = 'FILE' AND "blobPathname" IS NOT NULL AND "textContent" IS NULL)
  OR ("kind" = 'TEXT' AND "blobPathname" IS NULL AND "textContent" IS NOT NULL)
);

-- Existing MiniCourse rows become unified Course rows with fresh IDs. Keeping
-- the legacy ID makes redirects deterministic without risking UUID collisions.
INSERT INTO "Course" (
  "id", "ownerId", "teacherId", "title", "description", "subject", "audience",
  "objectives", "level", "background", "durationMinutes", "language",
  "publicationStatus", "status", "phase", "legacyMiniCourseId", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  mc."ownerId",
  CASE WHEN u."role" = 'teacher' THEN mc."ownerId" ELSE NULL END,
  mc."title",
  mc."summary",
  mc."subject",
  mc."audience",
  mc."objectives",
  mc."level",
  mc."background",
  mc."durationMinutes",
  mc."language",
  'DRAFT'::"CoursePublicationStatus",
  'READY'::"CourseStatus",
  'Ready to edit course content',
  mc."id",
  mc."createdAt",
  mc."updatedAt"
FROM "MiniCourse" mc
JOIN "User" u ON u."id" = mc."ownerId";

INSERT INTO "CourseChapter" ("id", "courseId", "ordinal", "title", "objectives", "createdAt", "updatedAt")
SELECT mcc."id", c."id", mcc."ordinal", mcc."title", mcc."objectives", mcc."createdAt", mcc."updatedAt"
FROM "MiniCourseChapter" mcc
JOIN "Course" c ON c."legacyMiniCourseId" = mcc."courseId";

INSERT INTO "CourseBlock" ("id", "chapterId", "ordinal", "type", "payload", "createdAt", "updatedAt")
SELECT mcb."id", mcb."chapterId", mcb."ordinal", mcb."type", mcb."payload", mcb."createdAt", mcb."updatedAt"
FROM "MiniCourseBlock" mcb;

INSERT INTO "CourseResource" ("id", "courseId", "chapterId", "kind", "title", "url", "ordinal", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  c."id",
  NULL,
  CASE resource.value->>'kind'
    WHEN 'video' THEN 'VIDEO'::"CourseResourceKind"
    WHEN 'file' THEN 'FILE'::"CourseResourceKind"
    ELSE 'LINK'::"CourseResourceKind"
  END,
  COALESCE(resource.value->>'title', ''),
  COALESCE(resource.value->>'url', ''),
  resource.ordinality::integer,
  mc."createdAt",
  mc."updatedAt"
FROM "MiniCourse" mc
JOIN "Course" c ON c."legacyMiniCourseId" = mc."id"
CROSS JOIN LATERAL jsonb_array_elements(mc."resources") WITH ORDINALITY AS resource(value, ordinality)
WHERE COALESCE(resource.value->>'url', '') <> '';

INSERT INTO "CourseResource" ("id", "courseId", "chapterId", "kind", "title", "url", "ordinal", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  c."id",
  mcc."id",
  CASE resource.value->>'kind'
    WHEN 'video' THEN 'VIDEO'::"CourseResourceKind"
    WHEN 'file' THEN 'FILE'::"CourseResourceKind"
    ELSE 'LINK'::"CourseResourceKind"
  END,
  COALESCE(resource.value->>'title', ''),
  COALESCE(resource.value->>'url', ''),
  resource.ordinality::integer,
  mcc."createdAt",
  mcc."updatedAt"
FROM "MiniCourseChapter" mcc
JOIN "Course" c ON c."legacyMiniCourseId" = mcc."courseId"
CROSS JOIN LATERAL jsonb_array_elements(mcc."resources") WITH ORDINALITY AS resource(value, ordinality)
WHERE COALESCE(resource.value->>'url', '') <> '';

INSERT INTO "UsageEvent" (
  "id", "courseId", "category", "operation", "provider", "model", "status",
  "durationMs", "inputTokens", "outputTokens", "totalTokens", "errorDetail",
  "metadata", "createdAt", "completedAt"
)
SELECT
  gen_random_uuid()::text,
  c."id",
  'ai',
  usage."operation",
  usage."provider",
  usage."model",
  lower(usage."status"),
  usage."durationMs",
  usage."inputTokens",
  usage."outputTokens",
  usage."totalTokens",
  usage."errorDetail",
  jsonb_build_object('legacyMiniCourseAiUsageId', usage."id"),
  usage."createdAt",
  usage."createdAt"
FROM "MiniCourseAiUsage" usage
JOIN "Course" c ON c."legacyMiniCourseId" = usage."courseId";
