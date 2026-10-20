CREATE TYPE "CourseStatus" AS ENUM ('INGESTING', 'AWAITING_MATERIAL_FIX', 'EXTRACTING_ENTITIES', 'AWAITING_ENTITY_REVIEW', 'READY', 'FAILED');
CREATE TYPE "MaterialStatus" AS ENUM ('UPLOADED', 'PARSING', 'READY', 'FAILED');
CREATE TYPE "AssignmentStatus" AS ENUM ('GENERATING', 'DRAFT', 'SUBMITTED', 'FAILED');
CREATE TYPE "QuestionVersionStatus" AS ENUM ('CANDIDATE', 'ACCEPTED', 'REJECTED');
CREATE TYPE "UsageRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

CREATE TABLE "Course" (
  "id" TEXT NOT NULL, "teacherId" TEXT NOT NULL, "title" TEXT NOT NULL, "category" TEXT,
  "description" TEXT NOT NULL DEFAULT '', "status" "CourseStatus" NOT NULL DEFAULT 'INGESTING',
  "phase" TEXT NOT NULL DEFAULT 'Waiting for material processing', "entityRevision" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CourseMaterial" (
  "id" TEXT NOT NULL, "courseId" TEXT NOT NULL, "name" TEXT NOT NULL, "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL, "blobPathname" TEXT NOT NULL, "status" "MaterialStatus" NOT NULL DEFAULT 'UPLOADED',
  "pageCount" INTEGER, "errorCode" TEXT, "errorDetail" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "CourseMaterial_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SourceSegment" (
  "id" TEXT NOT NULL, "courseId" TEXT NOT NULL, "materialId" TEXT NOT NULL, "ordinal" INTEGER NOT NULL,
  "locator" JSONB NOT NULL, "rawText" TEXT NOT NULL, "normalizedText" TEXT NOT NULL,
  "normalizationStatus" TEXT NOT NULL DEFAULT 'raw', "hash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "SourceSegment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "KnowledgeEntity" (
  "id" TEXT NOT NULL, "courseId" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '',
  "aliases" JSONB NOT NULL DEFAULT '[]', "importance" TEXT NOT NULL DEFAULT 'supporting', "selected" BOOLEAN NOT NULL DEFAULT true,
  "evidence" JSONB NOT NULL DEFAULT '[]', "parentId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "KnowledgeEntity_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Assignment" (
  "id" TEXT NOT NULL, "courseId" TEXT NOT NULL, "title" TEXT NOT NULL, "status" "AssignmentStatus" NOT NULL DEFAULT 'GENERATING',
  "originalBrief" JSONB NOT NULL, "questions" JSONB NOT NULL DEFAULT '[]', "failedSlots" JSONB NOT NULL DEFAULT '[]',
  "qualityWarnings" JSONB NOT NULL DEFAULT '[]', "version" INTEGER NOT NULL DEFAULT 0, "error" TEXT, "submittedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AssignmentSlotLease" (
  "id" TEXT NOT NULL, "assignmentId" TEXT NOT NULL, "slotIndex" INTEGER NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AssignmentSlotLease_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "QuestionVersion" (
  "id" TEXT NOT NULL, "assignmentId" TEXT NOT NULL, "questionId" TEXT NOT NULL, "instruction" TEXT NOT NULL,
  "payload" JSONB NOT NULL, "status" "QuestionVersionStatus" NOT NULL DEFAULT 'CANDIDATE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "QuestionVersion_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "UsageRun" (
  "id" TEXT NOT NULL, "courseId" TEXT NOT NULL, "assignmentId" TEXT, "teacherId" TEXT NOT NULL, "kind" TEXT NOT NULL,
  "status" "UsageRunStatus" NOT NULL DEFAULT 'RUNNING', "error" TEXT, "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3), CONSTRAINT "UsageRun_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "UsageEvent" (
  "id" TEXT NOT NULL, "runId" TEXT, "courseId" TEXT NOT NULL, "assignmentId" TEXT, "category" TEXT NOT NULL,
  "operation" TEXT NOT NULL, "provider" TEXT, "model" TEXT, "status" TEXT NOT NULL, "attempt" INTEGER NOT NULL DEFAULT 1,
  "durationMs" INTEGER, "requestPayload" JSONB, "responsePayload" JSONB, "requestBytes" INTEGER NOT NULL DEFAULT 0,
  "responseBytes" INTEGER NOT NULL DEFAULT 0, "inputTokens" INTEGER, "outputTokens" INTEGER, "totalTokens" INTEGER,
  "providerRequestId" TEXT, "errorCode" TEXT, "errorDetail" TEXT, "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3), "payloadExpiresAt" TIMESTAMP(3),
  CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "UsageBucket" (
  "id" TEXT NOT NULL, "courseId" TEXT NOT NULL, "teacherId" TEXT NOT NULL, "windowKind" TEXT NOT NULL,
  "windowKey" TEXT NOT NULL, "count" INTEGER NOT NULL DEFAULT 0, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UsageBucket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Course_teacherId_updatedAt_idx" ON "Course"("teacherId", "updatedAt");
CREATE INDEX "Course_teacherId_status_idx" ON "Course"("teacherId", "status");
CREATE UNIQUE INDEX "CourseMaterial_blobPathname_key" ON "CourseMaterial"("blobPathname");
CREATE INDEX "CourseMaterial_courseId_status_idx" ON "CourseMaterial"("courseId", "status");
CREATE INDEX "SourceSegment_courseId_ordinal_idx" ON "SourceSegment"("courseId", "ordinal");
CREATE UNIQUE INDEX "SourceSegment_materialId_ordinal_key" ON "SourceSegment"("materialId", "ordinal");
CREATE INDEX "KnowledgeEntity_courseId_selected_idx" ON "KnowledgeEntity"("courseId", "selected");
CREATE INDEX "KnowledgeEntity_parentId_idx" ON "KnowledgeEntity"("parentId");
CREATE INDEX "Assignment_courseId_updatedAt_idx" ON "Assignment"("courseId", "updatedAt");
CREATE INDEX "Assignment_courseId_status_idx" ON "Assignment"("courseId", "status");
CREATE INDEX "AssignmentSlotLease_expiresAt_idx" ON "AssignmentSlotLease"("expiresAt");
CREATE UNIQUE INDEX "AssignmentSlotLease_assignmentId_slotIndex_key" ON "AssignmentSlotLease"("assignmentId", "slotIndex");
CREATE INDEX "QuestionVersion_assignmentId_questionId_status_idx" ON "QuestionVersion"("assignmentId", "questionId", "status");
CREATE INDEX "UsageRun_teacherId_startedAt_idx" ON "UsageRun"("teacherId", "startedAt");
CREATE INDEX "UsageRun_courseId_startedAt_idx" ON "UsageRun"("courseId", "startedAt");
CREATE INDEX "UsageEvent_courseId_createdAt_idx" ON "UsageEvent"("courseId", "createdAt");
CREATE INDEX "UsageEvent_runId_createdAt_idx" ON "UsageEvent"("runId", "createdAt");
CREATE INDEX "UsageEvent_payloadExpiresAt_idx" ON "UsageEvent"("payloadExpiresAt");
CREATE INDEX "UsageBucket_courseId_updatedAt_idx" ON "UsageBucket"("courseId", "updatedAt");
CREATE UNIQUE INDEX "UsageBucket_teacherId_windowKind_windowKey_key" ON "UsageBucket"("teacherId", "windowKind", "windowKey");

ALTER TABLE "Course" ADD CONSTRAINT "Course_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseMaterial" ADD CONSTRAINT "CourseMaterial_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SourceSegment" ADD CONSTRAINT "SourceSegment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SourceSegment" ADD CONSTRAINT "SourceSegment_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "CourseMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeEntity" ADD CONSTRAINT "KnowledgeEntity_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeEntity" ADD CONSTRAINT "KnowledgeEntity_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "KnowledgeEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentSlotLease" ADD CONSTRAINT "AssignmentSlotLease_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestionVersion" ADD CONSTRAINT "QuestionVersion_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageRun" ADD CONSTRAINT "UsageRun_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageRun" ADD CONSTRAINT "UsageRun_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UsageRun" ADD CONSTRAINT "UsageRun_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "UsageRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UsageBucket" ADD CONSTRAINT "UsageBucket_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
