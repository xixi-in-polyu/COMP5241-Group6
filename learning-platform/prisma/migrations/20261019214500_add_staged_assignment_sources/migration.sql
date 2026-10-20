ALTER TYPE "MaterialStatus" ADD VALUE IF NOT EXISTS 'NEEDS_INPUT';

ALTER TYPE "AssignmentStatus" ADD VALUE IF NOT EXISTS 'INGESTING';
ALTER TYPE "AssignmentStatus" ADD VALUE IF NOT EXISTS 'AWAITING_MATERIAL_FIX';
ALTER TYPE "AssignmentStatus" ADD VALUE IF NOT EXISTS 'EXTRACTING_ENTITIES';
ALTER TYPE "AssignmentStatus" ADD VALUE IF NOT EXISTS 'AWAITING_ENTITY_REVIEW';
ALTER TYPE "AssignmentStatus" ADD VALUE IF NOT EXISTS 'READY_TO_GENERATE';

CREATE TYPE "AssignmentMaterialKind" AS ENUM ('FILE', 'VIDEO', 'TRANSCRIPT');

ALTER TABLE "Assignment"
  ADD COLUMN "phase" TEXT NOT NULL DEFAULT 'Waiting to select sources',
  ADD COLUMN "entityRevision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "workflowHookToken" TEXT,
  ADD COLUMN "ingestionRunId" TEXT,
  ALTER COLUMN "status" SET DEFAULT 'INGESTING',
  ALTER COLUMN "originalBrief" DROP NOT NULL;

CREATE TABLE "AssignmentMaterial" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "AssignmentMaterialKind" NOT NULL,
  "mimeType" TEXT,
  "size" INTEGER,
  "blobPathname" TEXT,
  "sourceUrl" TEXT,
  "pageCount" INTEGER,
  "durationSeconds" INTEGER,
  "captionMode" TEXT,
  "captionAttemptedAt" TIMESTAMP(3),
  "status" "MaterialStatus" NOT NULL DEFAULT 'UPLOADED',
  "errorCode" TEXT,
  "errorDetail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssignmentMaterial_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssignmentSourceSegment" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "materialId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "locator" JSONB NOT NULL,
  "rawText" TEXT NOT NULL,
  "normalizedText" TEXT NOT NULL,
  "normalizationStatus" TEXT NOT NULL DEFAULT 'raw',
  "hash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssignmentSourceSegment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssignmentKnowledgeEntity" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "sourceCourseEntityId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "aliases" JSONB NOT NULL DEFAULT '[]',
  "importance" TEXT NOT NULL DEFAULT 'supporting',
  "selected" BOOLEAN NOT NULL DEFAULT true,
  "evidence" JSONB NOT NULL DEFAULT '[]',
  "parentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssignmentKnowledgeEntity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssignmentMaterial_blobPathname_key" ON "AssignmentMaterial"("blobPathname");
CREATE INDEX "AssignmentMaterial_assignmentId_status_idx" ON "AssignmentMaterial"("assignmentId", "status");
CREATE INDEX "AssignmentMaterial_assignmentId_kind_idx" ON "AssignmentMaterial"("assignmentId", "kind");
CREATE UNIQUE INDEX "AssignmentSourceSegment_materialId_ordinal_key" ON "AssignmentSourceSegment"("materialId", "ordinal");
CREATE INDEX "AssignmentSourceSegment_assignmentId_ordinal_idx" ON "AssignmentSourceSegment"("assignmentId", "ordinal");
CREATE INDEX "AssignmentKnowledgeEntity_assignmentId_selected_idx" ON "AssignmentKnowledgeEntity"("assignmentId", "selected");
CREATE INDEX "AssignmentKnowledgeEntity_assignmentId_sourceCourseEntityId_idx" ON "AssignmentKnowledgeEntity"("assignmentId", "sourceCourseEntityId");
CREATE INDEX "AssignmentKnowledgeEntity_parentId_idx" ON "AssignmentKnowledgeEntity"("parentId");

ALTER TABLE "AssignmentMaterial" ADD CONSTRAINT "AssignmentMaterial_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssignmentSourceSegment" ADD CONSTRAINT "AssignmentSourceSegment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssignmentSourceSegment" ADD CONSTRAINT "AssignmentSourceSegment_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "AssignmentMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssignmentKnowledgeEntity" ADD CONSTRAINT "AssignmentKnowledgeEntity_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssignmentKnowledgeEntity" ADD CONSTRAINT "AssignmentKnowledgeEntity_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AssignmentKnowledgeEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX "Assignment_one_generating_per_course_key";
CREATE UNIQUE INDEX "Assignment_one_active_workflow_per_course_key"
ON "Assignment"("courseId")
WHERE "status" IN ('INGESTING', 'EXTRACTING_ENTITIES', 'GENERATING');
