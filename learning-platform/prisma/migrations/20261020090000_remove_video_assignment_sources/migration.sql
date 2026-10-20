-- Remove assignment video sources before narrowing their enum type.
DELETE FROM "AssignmentMaterial"
WHERE "kind" = 'VIDEO';

-- NEEDS_INPUT was only used by the removed video transcript recovery flow.
UPDATE "CourseMaterial"
SET "status" = 'FAILED'
WHERE "status" = 'NEEDS_INPUT';

UPDATE "AssignmentMaterial"
SET "status" = 'FAILED'
WHERE "status" = 'NEEDS_INPUT';

ALTER TABLE "CourseMaterial"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "AssignmentMaterial"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TYPE "MaterialStatus" RENAME TO "MaterialStatus_old";
CREATE TYPE "MaterialStatus" AS ENUM ('UPLOADED', 'PARSING', 'READY', 'FAILED');

ALTER TABLE "CourseMaterial"
  ALTER COLUMN "status" TYPE "MaterialStatus"
  USING ("status"::text::"MaterialStatus"),
  ALTER COLUMN "status" SET DEFAULT 'UPLOADED';

ALTER TABLE "AssignmentMaterial"
  ALTER COLUMN "status" TYPE "MaterialStatus"
  USING ("status"::text::"MaterialStatus"),
  ALTER COLUMN "status" SET DEFAULT 'UPLOADED';

DROP TYPE "MaterialStatus_old";

ALTER TYPE "AssignmentMaterialKind" RENAME TO "AssignmentMaterialKind_old";
CREATE TYPE "AssignmentMaterialKind" AS ENUM ('FILE', 'TRANSCRIPT');

ALTER TABLE "AssignmentMaterial"
  ALTER COLUMN "kind" TYPE "AssignmentMaterialKind"
  USING ("kind"::text::"AssignmentMaterialKind");

DROP TYPE "AssignmentMaterialKind_old";

ALTER TABLE "AssignmentMaterial"
  DROP COLUMN "sourceUrl",
  DROP COLUMN "durationSeconds",
  DROP COLUMN "captionMode",
  DROP COLUMN "captionAttemptedAt";
