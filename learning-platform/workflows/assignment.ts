import { head } from "@vercel/blob";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { extractEntities, generateQuestion, normalizeTranscript, reviewQuestions, validateGroundedQuestion } from "@/lib/assignments/ai";
import { loadAssignmentKnowledgeContext } from "@/lib/assignments/context";
import { briefSchema, createQuestionSlots, entitySchema, failedSlotsSchema, questionsSchema, type FailedSlot, type Question, type QuestionSlot } from "@/lib/assignments/domain";
import { getAssignmentSourceReadiness, mergeAssignmentEntities, snapshotCourseEntities, validateAssignmentSourceSelection, type AssignmentEntitySnapshot } from "@/lib/assignments/staged";
import { finishUsageRun } from "@/lib/assignments/usage";
import { parseMaterial, validateMaterialMetadata } from "@/lib/materials/parsers";
import { mapBlobMaterialError } from "@/lib/materials/blob-errors";
import { parseSubtitles, validateTranscriptMetadata } from "@/lib/materials/subtitles";
import { MaterialError } from "@/lib/materials/types";
import { fetchYouTubeCaptions } from "@/lib/materials/youtube-captions";
import { segmentUnits } from "@/lib/materials/segment";
import { assignmentEntityReviewHook, assignmentMaterialReadyHook } from "./hooks";

const json = (value: unknown) => value as Prisma.InputJsonValue;

export async function ingestionWorkflow(courseId: string, usageRunId: string) {
  "use workflow";
  try {
    const result = await parseMaterialsStep(courseId);
    if (!result.ready) {
      await finishIngestionStep(courseId, usageRunId, false);
      return { courseId, status: "AWAITING_MATERIAL_FIX" as const };
    }
    await extractEntitiesStep(courseId, usageRunId);
    await finishUsageRunStep(usageRunId, true);
    return { courseId, status: "AWAITING_ENTITY_REVIEW" as const };
  } catch (error) {
    await failCourseStep(courseId, usageRunId, error instanceof Error ? error.message : "Course ingestion failed.");
    throw error;
  }
}

async function parseMaterialsStep(courseId: string) {
  "use step";
  const course = await prisma.course.findUnique({ where: { id: courseId }, include: { materials: true } });
  if (!course) throw new Error("Course not found.");
  if (!course.materials.length) throw new Error("At least one source document is required.");
  await prisma.course.update({ where: { id: courseId }, data: { status: "INGESTING", phase: "Parsing source materials", error: null } });
  for (const material of course.materials.filter((item) => item.status === "UPLOADED")) {
    try {
      await prisma.courseMaterial.update({ where: { id: material.id }, data: { status: "PARSING", errorCode: null, errorDetail: null } });
      validateMaterialMetadata(material.name, material.mimeType, material.size);
      const blob = await head(material.blobPathname);
      const response = await fetch(blob.downloadUrl, { headers: process.env.BLOB_READ_WRITE_TOKEN ? { authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` } : undefined });
      if (!response.ok) throw new MaterialError("BLOB_DOWNLOAD_FAILED", `Blob download failed (${response.status}).`);
      const parsed = await parseMaterial(new Uint8Array(await response.arrayBuffer()), material.name);
      const segments = segmentUnits(parsed.units);
      await prisma.$transaction([
        prisma.sourceSegment.deleteMany({ where: { materialId: material.id } }),
        prisma.sourceSegment.createMany({ data: segments.map((segment) => ({ courseId, materialId: material.id, ordinal: segment.ordinal, locator: json(segment.locator), rawText: segment.text, normalizedText: segment.text, hash: segment.hash })) }),
        prisma.courseMaterial.update({ where: { id: material.id }, data: { status: "READY", pageCount: parsed.pageCount, errorCode: null, errorDetail: null } }),
      ]);
    } catch (error) {
      const failure = mapBlobMaterialError(error, "Parsing failed.");
      await prisma.courseMaterial.update({ where: { id: material.id }, data: { status: "FAILED", errorCode: failure.code, errorDetail: failure.message } });
    }
  }
  const failed = await prisma.courseMaterial.count({ where: { courseId, status: "FAILED" } });
  if (failed) {
    await prisma.course.update({ where: { id: courseId }, data: { status: "AWAITING_MATERIAL_FIX", phase: "Retry, replace, or remove failed materials" } });
    return { ready: false };
  }
  return { ready: true };
}

async function extractEntitiesStep(courseId: string, usageRunId: string) {
  "use step";
  await prisma.course.update({ where: { id: courseId }, data: { status: "EXTRACTING_ENTITIES", phase: "Extracting grounded knowledge entities" } });
  const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId }, include: { segments: true, materials: true } });
  const entities = await extractEntities(course.segments, new Map(course.materials.map((item) => [item.id, item.name])), { courseId, runId: usageRunId, operation: "entity_extraction" });
  if (!entities.length) throw new Error("No grounded knowledge entities could be extracted.");
  await prisma.$transaction(async (tx) => {
    await tx.knowledgeEntity.deleteMany({ where: { courseId } });
    for (const entity of entities) await tx.knowledgeEntity.create({ data: { id: entity.id, courseId, name: entity.name, description: entity.description, aliases: json(entity.aliases), importance: entity.importance, selected: entity.selected, evidence: json(entity.evidence) } });
    for (const entity of entities.filter((item) => item.parentId)) await tx.knowledgeEntity.update({ where: { id: entity.id }, data: { parentId: entity.parentId } });
    await tx.course.update({ where: { id: courseId }, data: { status: "AWAITING_ENTITY_REVIEW", phase: "Review and confirm the knowledge graph", entityRevision: { increment: 1 } } });
  });
}

async function finishIngestionStep(courseId: string, usageRunId: string, success: boolean) {
  "use step";
  void courseId;
  await finishUsageRun(usageRunId, success ? "SUCCESS" : "FAILED", success ? undefined : "One or more materials require attention.");
}

async function finishUsageRunStep(usageRunId: string, success: boolean) {
  "use step";
  await finishUsageRun(usageRunId, success ? "SUCCESS" : "FAILED");
}

async function failCourseStep(courseId: string, usageRunId: string, error: string) {
  "use step";
  await prisma.course.update({ where: { id: courseId }, data: { status: "FAILED", phase: "Ingestion failed", error } });
  await finishUsageRun(usageRunId, "FAILED", error);
}

export async function assignmentIngestionWorkflow(
  assignmentId: string,
  usageRunId: string,
) {
  "use workflow";
  try {
    let ready = false;
    for (let round = 0; round < 8; round += 1) {
      const token = `assignment-material-ready:${assignmentId}:${round}`;
      const hook = assignmentMaterialReadyHook.create({ token });
      const result = await processAssignmentMaterialsStep(
        assignmentId,
        usageRunId,
        token,
      );
      if (result === "ready") {
        hook.dispose();
        ready = true;
        break;
      }
      await hook;
    }
    if (!ready) throw new Error("Material repair retry limit reached.");

    const revision = await extractAssignmentEntitiesStep(
      assignmentId,
      usageRunId,
    );
    const token = `assignment-entity-review:${assignmentId}:${revision}`;
    const hook = assignmentEntityReviewHook.create({ token });
    await waitForAssignmentEntityReviewStep(assignmentId, token);
    await hook;
    await readyAssignmentStep(assignmentId, usageRunId);
    return { assignmentId, status: "READY_TO_GENERATE" as const };
  } catch (error) {
    await failStagedAssignmentStep(
      assignmentId,
      usageRunId,
      error instanceof Error ? error.message : "Assignment ingestion failed.",
    );
    throw error;
  }
}

async function processAssignmentMaterialsStep(
  assignmentId: string,
  usageRunId: string,
  hookToken: string,
) {
  "use step";
  const assignment = await prisma.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: {
      materials: true,
      course: { include: { entities: { where: { selected: true } } } },
    },
  });
  validateAssignmentSourceSelection(assignment.materials);

  await prisma.assignment.update({
    where: { id: assignmentId },
    data: {
      status: "INGESTING",
      phase: "Processing assignment sources",
      workflowHookToken: null,
      error: null,
    },
  });

  for (const material of assignment.materials.filter((item) =>
    ["UPLOADED", "PARSING"].includes(item.status),
  )) {
    try {
      await prisma.assignmentMaterial.update({
        where: { id: material.id },
        data: {
          status: "PARSING",
          errorCode: null,
          errorDetail: null,
          ...(material.kind === "VIDEO" ? { captionAttemptedAt: new Date() } : {}),
        },
      });
      if (material.kind === "VIDEO") {
        const result = await fetchYouTubeCaptions(material.sourceUrl || "", {
          onAttempt: async (attempt) => {
            await prisma.usageEvent.create({
              data: {
                runId: usageRunId,
                courseId: assignment.courseId,
                assignmentId,
                category: "media",
                operation: attempt.operation,
                status: attempt.status,
                attempt: attempt.attempt,
                durationMs: attempt.durationMs,
                errorCode: attempt.errorCode,
                errorDetail: attempt.errorDetail,
                metadata: json(
                  attempt.retryReason
                    ? { retryReason: attempt.retryReason }
                    : {},
                ),
                completedAt: new Date(),
              },
            });
          },
        });
        const segmented = segmentUnits(result.units);
        let normalized = segmented.map((segment) => ({
          ...segment,
          normalizedText: segment.text,
          normalizationStatus: "raw",
        }));
        if (result.mode === "automatic_caption") {
          try {
            const corrected = await normalizeTranscript(
              normalized.map((segment) => ({
                id: segment.hash,
                text: segment.text,
              })),
              {
                courseId: assignment.courseId,
                assignmentId,
                runId: usageRunId,
                operation: "transcript_normalization",
              },
            );
            const byId = new Map(
              corrected.map((segment) => [segment.id, segment.text]),
            );
            normalized = normalized.map((segment) => ({
              ...segment,
              normalizedText: byId.get(segment.hash) || segment.text,
              normalizationStatus: "normalized",
            }));
          } catch {
            normalized = normalized.map((segment) => ({
              ...segment,
              normalizationStatus: "warning",
            }));
          }
        }
        await saveAssignmentSegments(assignmentId, material.id, normalized);
        await prisma.assignmentMaterial.update({
          where: { id: material.id },
          data: {
            name: result.title,
            status: "READY",
            durationSeconds: result.durationSeconds,
            captionMode: result.mode,
          },
        });
        continue;
      }

      if (!material.blobPathname) {
        throw new MaterialError(
          "BLOB_REFERENCE_MISSING",
          "Uploaded source has no Blob pathname.",
        );
      }
      if (material.kind === "TRANSCRIPT") {
        validateTranscriptMetadata(
          material.name,
          material.mimeType || "text/plain",
          material.size || 0,
        );
      } else {
        validateMaterialMetadata(
          material.name,
          material.mimeType || "text/plain",
          material.size || 0,
        );
      }
      const blob = await head(material.blobPathname);
      const response = await fetch(blob.downloadUrl, {
        headers: process.env.BLOB_READ_WRITE_TOKEN
          ? { authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
          : undefined,
      });
      if (!response.ok) {
        throw new MaterialError(
          "BLOB_DOWNLOAD_FAILED",
          `Blob download failed (${response.status}).`,
        );
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      const extension = material.name.split(".").pop()?.toLowerCase();
      const parsed =
        material.kind === "TRANSCRIPT" && ["srt", "vtt"].includes(extension || "")
          ? { units: parseSubtitles(new TextDecoder().decode(bytes)) }
          : await parseMaterial(bytes, material.name);
      const segmented = segmentUnits(parsed.units).map((segment) => ({
        ...segment,
        normalizedText: segment.text,
        normalizationStatus: "raw",
      }));
      await saveAssignmentSegments(assignmentId, material.id, segmented);
      await prisma.assignmentMaterial.update({
        where: { id: material.id },
        data: {
          status: "READY",
          pageCount: "pageCount" in parsed ? parsed.pageCount : undefined,
        },
      });
    } catch (error) {
      const failure = mapBlobMaterialError(error, "Source processing failed.");
      const needsInput =
        material.kind === "VIDEO" &&
        [
          "YOUTUBE_CAPTIONS_REQUIRED",
          "YOUTUBE_ACCESS_BLOCKED",
          "YOUTUBE_CAPTION_INVALID",
        ].includes(failure.code);
      await prisma.assignmentMaterial.update({
        where: { id: material.id },
        data: {
          status: needsInput ? "NEEDS_INPUT" : "FAILED",
          errorCode: failure.code,
          errorDetail: failure.message,
        },
      });
    }
  }

  const refreshed = await prisma.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: { materials: true, course: { include: { entities: true } } },
  });
  const hasCourseKnowledge = refreshed.course.entities.some(
    (entity) => entity.selected,
  );
  const readiness = getAssignmentSourceReadiness(
    refreshed.materials,
    hasCourseKnowledge,
  );
  const sourceMissing = !refreshed.materials.length && !hasCourseKnowledge;
  if (readiness === "fix") {
    await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        status: "AWAITING_MATERIAL_FIX",
        phase: sourceMissing
          ? "Add a source before continuing"
          : "Retry, replace, remove, or provide a transcript",
        workflowHookToken: hookToken,
      },
    });
    return "fix" as const;
  }
  if (readiness === "processing") {
    throw new Error("Assignment sources did not reach a terminal state.");
  }
  return "ready" as const;
}

async function saveAssignmentSegments(
  assignmentId: string,
  materialId: string,
  segments: Array<{
    ordinal: number;
    locator: unknown;
    text: string;
    normalizedText: string;
    normalizationStatus: string;
    hash: string;
  }>,
) {
  await prisma.$transaction([
    prisma.assignmentSourceSegment.deleteMany({ where: { materialId } }),
    prisma.assignmentSourceSegment.createMany({
      data: segments.map((segment) => ({
        assignmentId,
        materialId,
        ordinal: segment.ordinal,
        locator: json(segment.locator),
        rawText: segment.text,
        normalizedText: segment.normalizedText,
        normalizationStatus: segment.normalizationStatus,
        hash: segment.hash,
      })),
    }),
  ]);
}

async function extractAssignmentEntitiesStep(
  assignmentId: string,
  usageRunId: string,
) {
  "use step";
  await prisma.assignment.update({
    where: { id: assignmentId },
    data: {
      status: "EXTRACTING_ENTITIES",
      phase: "Building assignment knowledge",
      workflowHookToken: null,
    },
  });
  const assignment = await prisma.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: {
      materials: true,
      segments: true,
      course: { include: { entities: true } },
    },
  });
  const courseEntities = assignment.course.entities
    .filter((entity) => entity.selected)
    .map((entity) =>
      entitySchema.parse({
        ...entity,
        aliases: entity.aliases,
        evidence: entity.evidence,
      }),
    );
  const snapshots = snapshotCourseEntities(courseEntities);
  const extracted = assignment.segments.length
    ? await extractEntities(
        assignment.segments,
        new Map(assignment.materials.map((material) => [material.id, material.name])),
        {
          courseId: assignment.courseId,
          assignmentId,
          runId: usageRunId,
          operation: "assignment_entity_extraction",
        },
      )
    : [];
  const merged = mergeAssignmentEntities(snapshots, extracted);
  if (!merged.length) {
    throw new Error("No grounded knowledge entities are available.");
  }
  await replaceAssignmentEntities(assignmentId, merged);
  const updated = await prisma.assignment.update({
    where: { id: assignmentId },
    data: { entityRevision: { increment: 1 } },
    select: { entityRevision: true },
  });
  return updated.entityRevision;
}

async function replaceAssignmentEntities(
  assignmentId: string,
  entities: AssignmentEntitySnapshot[],
) {
  await prisma.$transaction(async (tx) => {
    await tx.assignmentKnowledgeEntity.deleteMany({ where: { assignmentId } });
    for (const entity of entities) {
      await tx.assignmentKnowledgeEntity.create({
        data: {
          id: entity.id,
          assignmentId,
          sourceCourseEntityId: entity.sourceCourseEntityId,
          name: entity.name,
          description: entity.description,
          aliases: json(entity.aliases),
          importance: entity.importance,
          selected: entity.selected,
          evidence: json(entity.evidence),
        },
      });
    }
    for (const entity of entities.filter((item) => item.parentId)) {
      await tx.assignmentKnowledgeEntity.update({
        where: { id: entity.id },
        data: { parentId: entity.parentId },
      });
    }
  });
}

async function waitForAssignmentEntityReviewStep(
  assignmentId: string,
  token: string,
) {
  "use step";
  await prisma.assignment.update({
    where: { id: assignmentId },
    data: {
      status: "AWAITING_ENTITY_REVIEW",
      phase: "Review and confirm assignment knowledge",
      workflowHookToken: token,
    },
  });
}

async function readyAssignmentStep(assignmentId: string, usageRunId: string) {
  "use step";
  await prisma.assignment.update({
    where: { id: assignmentId },
    data: {
      status: "READY_TO_GENERATE",
      phase: "Ready to define the assignment brief",
      workflowHookToken: null,
      error: null,
    },
  });
  await finishUsageRun(usageRunId, "SUCCESS");
}

async function failStagedAssignmentStep(
  assignmentId: string,
  usageRunId: string,
  error: string,
) {
  "use step";
  const latestFailure = await prisma.usageEvent.findFirst({
    where: { runId: usageRunId, errorDetail: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { operation: true, errorCode: true, errorDetail: true },
  });
  const resolvedError = latestFailure?.errorDetail || error;
  console.error("[assignment-ingestion] workflow failed", {
    assignmentId,
    usageRunId,
    operation: latestFailure?.operation,
    errorCode: latestFailure?.errorCode,
    error: resolvedError,
  });
  await prisma.assignment.update({
    where: { id: assignmentId },
    data: {
      status: "FAILED",
      phase: "Assignment source workflow failed",
      workflowHookToken: null,
      error: resolvedError,
    },
  });
  await finishUsageRun(usageRunId, "FAILED", resolvedError);
}

export async function generationWorkflow(assignmentId: string, usageRunId: string) {
  "use workflow";
  try {
    const slots = await prepareGenerationStep(assignmentId);
    const questions: Question[] = [];
    const failedSlots: FailedSlot[] = [];
    for (let offset = 0; offset < slots.length; offset += 4) {
      const batch = await Promise.all(slots.slice(offset, offset + 4).map((slot) => generateSlotStep(assignmentId, usageRunId, slot)));
      for (const result of batch) {
        if (result.question) questions.push(result.question);
        else failedSlots.push(result.failed!);
      }
    }
    const warnings = await reviewStep(assignmentId, usageRunId, questions);
    await finishGenerationStep(assignmentId, usageRunId, questions, failedSlots, warnings);
    return { assignmentId, status: "DRAFT" as const };
  } catch (error) {
    await failAssignmentStep(assignmentId, usageRunId, error instanceof Error ? error.message : "Generation failed.");
    throw error;
  }
}

async function prepareGenerationStep(assignmentId: string) {
  "use step";
  const assignment = await prisma.assignment.findUniqueOrThrow({ where: { id: assignmentId } });
  const brief = briefSchema.parse(assignment.originalBrief);
  const { entities } = await loadAssignmentKnowledgeContext(assignmentId);
  return createQuestionSlots(brief, entities.filter((item) => item.selected).map((item) => item.id));
}

async function generateSlotStep(assignmentId: string, usageRunId: string, slot: QuestionSlot): Promise<{ question?: Question; failed?: FailedSlot }> {
  "use step";
  const assignment = await prisma.assignment.findUniqueOrThrow({ where: { id: assignmentId } });
  const brief = briefSchema.parse(assignment.originalBrief);
  const { entities, segments } = await loadAssignmentKnowledgeContext(assignmentId);
  let reason = "Question generation failed.";
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const question = await generateQuestion(slot, brief, entities, segments, { courseId: assignment.courseId, assignmentId, runId: usageRunId, operation: "question_generation", attempt }, attempt === 2 ? [reason] : []);
      const diagnostics = validateGroundedQuestion(question, slot, entities, segments);
      if (!diagnostics.length) return { question };
      reason = diagnostics.join(" ");
    } catch (error) {
      reason = error instanceof Error ? error.message : "Question generation failed.";
    }
  }
  return { failed: { ...slot, reason } };
}

async function reviewStep(assignmentId: string, usageRunId: string, questions: Question[]) {
  "use step";
  const assignment = await prisma.assignment.findUniqueOrThrow({ where: { id: assignmentId } });
  const { entities, segments } = await loadAssignmentKnowledgeContext(assignmentId);
  try {
    return await reviewQuestions(questions, entities, segments, { courseId: assignment.courseId, assignmentId, runId: usageRunId, operation: "quality_review" });
  } catch (error) {
    return [`Quality review unavailable: ${error instanceof Error ? error.message : "unknown error"}`];
  }
}

async function finishGenerationStep(assignmentId: string, usageRunId: string, questions: Question[], failedSlots: FailedSlot[], warnings: string[]) {
  "use step";
  await prisma.assignment.update({ where: { id: assignmentId }, data: { status: "DRAFT", questions: json(questionsSchema.parse(questions)), failedSlots: json(failedSlotsSchema.parse(failedSlots)), qualityWarnings: json(warnings), error: null, version: { increment: 1 } } });
  await finishUsageRun(usageRunId, "SUCCESS");
}

async function failAssignmentStep(assignmentId: string, usageRunId: string, error: string) {
  "use step";
  await prisma.assignment.update({ where: { id: assignmentId }, data: { status: "FAILED", error } });
  await finishUsageRun(usageRunId, "FAILED", error);
}

export async function retryFailedSlot(assignmentId: string, usageRunId: string, slot: QuestionSlot) {
  "use workflow";
  const result = await generateSlotStep(assignmentId, usageRunId, slot);
  await resolveRetriedSlotStep(assignmentId, usageRunId, slot.index, result);
  return result;
}

async function resolveRetriedSlotStep(assignmentId: string, usageRunId: string, index: number, result: { question?: Question; failed?: FailedSlot }) {
  "use step";
  const assignment = await prisma.assignment.findUniqueOrThrow({ where: { id: assignmentId } });
  const questions = questionsSchema.parse(assignment.questions);
  const failures = failedSlotsSchema.parse(assignment.failedSlots);
  await prisma.$transaction([
    prisma.assignment.update({ where: { id: assignmentId }, data: { questions: json(result.question ? [...questions, result.question] : questions), failedSlots: json(result.question ? failures.filter((item) => item.index !== index) : failures.map((item) => item.index === index ? result.failed! : item)), version: { increment: 1 } } }),
    prisma.assignmentSlotLease.deleteMany({ where: { assignmentId, slotIndex: index } }),
  ]);
  await finishUsageRun(usageRunId, result.question ? "SUCCESS" : "FAILED", result.failed?.reason);
}
