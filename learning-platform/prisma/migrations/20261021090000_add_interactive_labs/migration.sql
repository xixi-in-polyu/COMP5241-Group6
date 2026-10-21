CREATE TYPE "InteractiveLabGenerationStatus" AS ENUM ('IDLE', 'GENERATING', 'FAILED');
CREATE TYPE "InteractiveLabVersionSource" AS ENUM ('INITIAL', 'ADD', 'UPDATE', 'RESTORE');
CREATE TYPE "InteractiveLabComponentType" AS ENUM ('auto', 'flashcards', 'matching', 'ordering', 'categorization', 'timeline', 'slider_explorer', 'quick_check');

CREATE TABLE "InteractiveLab" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "generationStatus" "InteractiveLabGenerationStatus" NOT NULL DEFAULT 'IDLE',
  "generationError" TEXT,
  "activeVersionId" TEXT,
  "approvedVersionId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InteractiveLab_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InteractiveLab_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "InteractiveLabVersion" (
  "id" TEXT NOT NULL,
  "labId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "source" "InteractiveLabVersionSource" NOT NULL,
  "instruction" TEXT NOT NULL,
  "requestedType" "InteractiveLabComponentType" NOT NULL,
  "actualType" "InteractiveLabComponentType" NOT NULL,
  "payload" JSONB NOT NULL,
  "restoredFromVersion" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InteractiveLabVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InteractiveLabVersion_labId_fkey" FOREIGN KEY ("labId") REFERENCES "InteractiveLab"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "InteractiveLab" ADD CONSTRAINT "InteractiveLab_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "InteractiveLabVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InteractiveLab" ADD CONSTRAINT "InteractiveLab_approvedVersionId_fkey" FOREIGN KEY ("approvedVersionId") REFERENCES "InteractiveLabVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "InteractiveLab_assignmentId_archivedAt_ordinal_idx" ON "InteractiveLab"("assignmentId", "archivedAt", "ordinal");
CREATE INDEX "InteractiveLab_assignmentId_generationStatus_idx" ON "InteractiveLab"("assignmentId", "generationStatus");
CREATE UNIQUE INDEX "InteractiveLab_activeVersionId_key" ON "InteractiveLab"("activeVersionId");
CREATE UNIQUE INDEX "InteractiveLab_approvedVersionId_key" ON "InteractiveLab"("approvedVersionId");
CREATE UNIQUE INDEX "InteractiveLab_one_generating_per_assignment_key" ON "InteractiveLab"("assignmentId") WHERE "generationStatus" = 'GENERATING';
CREATE UNIQUE INDEX "InteractiveLabVersion_labId_sequence_key" ON "InteractiveLabVersion"("labId", "sequence");
CREATE INDEX "InteractiveLabVersion_labId_createdAt_idx" ON "InteractiveLabVersion"("labId", "createdAt");
