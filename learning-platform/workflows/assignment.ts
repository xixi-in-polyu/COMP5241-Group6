import { head } from "@vercel/blob";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { extractEntities, generateQuestion, reviewQuestions, validateGroundedQuestion } from "@/lib/assignments/ai";
import { briefSchema, createQuestionSlots, entitySchema, failedSlotsSchema, questionsSchema, type FailedSlot, type Question, type QuestionSlot } from "@/lib/assignments/domain";
import { finishUsageRun } from "@/lib/assignments/usage";
import { parseMaterial, validateMaterialMetadata } from "@/lib/materials/parsers";
import { MaterialError } from "@/lib/materials/types";
import { segmentUnits } from "@/lib/materials/segment";

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
      const failure = error instanceof MaterialError ? error : new MaterialError("MATERIAL_PARSE_FAILED", error instanceof Error ? error.message : "Parsing failed.");
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
  const assignment = await prisma.assignment.findUniqueOrThrow({ where: { id: assignmentId }, include: { course: { include: { entities: true } } } });
  const brief = briefSchema.parse(assignment.originalBrief);
  const entities = assignment.course.entities.map((item) => entitySchema.parse({ ...item, aliases: item.aliases, evidence: item.evidence }));
  return createQuestionSlots(brief, entities.filter((item) => item.selected).map((item) => item.id));
}

async function generateSlotStep(assignmentId: string, usageRunId: string, slot: QuestionSlot): Promise<{ question?: Question; failed?: FailedSlot }> {
  "use step";
  const assignment = await prisma.assignment.findUniqueOrThrow({ where: { id: assignmentId }, include: { course: { include: { entities: true, segments: true } } } });
  const brief = briefSchema.parse(assignment.originalBrief);
  const entities = assignment.course.entities.map((item) => entitySchema.parse({ ...item, aliases: item.aliases, evidence: item.evidence }));
  let reason = "Question generation failed.";
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const question = await generateQuestion(slot, brief, entities, assignment.course.segments, { courseId: assignment.courseId, assignmentId, runId: usageRunId, operation: "question_generation", attempt }, attempt === 2 ? [reason] : []);
      const diagnostics = validateGroundedQuestion(question, slot, entities, assignment.course.segments);
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
  const assignment = await prisma.assignment.findUniqueOrThrow({ where: { id: assignmentId }, include: { course: { include: { entities: true, segments: true } } } });
  const entities = assignment.course.entities.map((item) => entitySchema.parse({ ...item, aliases: item.aliases, evidence: item.evidence }));
  try {
    return await reviewQuestions(questions, entities, assignment.course.segments, { courseId: assignment.courseId, assignmentId, runId: usageRunId, operation: "quality_review" });
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
