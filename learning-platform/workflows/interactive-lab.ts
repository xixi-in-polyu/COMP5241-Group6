import type { Prisma } from "@prisma/client";
import { generateInteractiveLab } from "@/lib/assignments/ai";
import { loadAssignmentKnowledgeContext } from "@/lib/assignments/context";
import { interactiveLabPayloadSchema, type InteractiveLabComponentType, type InteractiveLabPayload } from "@/lib/assignments/domain";
import { finishUsageRun } from "@/lib/assignments/usage";
import { prisma } from "@/lib/prisma";

const json = (value: unknown) => value as Prisma.InputJsonValue;

export async function interactiveLabGenerationWorkflow(
  labId: string,
  usageRunId: string,
  instruction: string,
  requestedType: InteractiveLabComponentType,
  source: "INITIAL" | "ADD" | "UPDATE",
) {
  "use workflow";
  const result = await generateInteractiveLabStep(labId, usageRunId, instruction, requestedType, source);
  await finishInteractiveLabStep(labId, usageRunId, instruction, requestedType, source, result);
  return result;
}

async function generateInteractiveLabStep(
  labId: string,
  usageRunId: string,
  instruction: string,
  requestedType: InteractiveLabComponentType,
  source: "INITIAL" | "ADD" | "UPDATE",
): Promise<{ payload?: InteractiveLabPayload; error?: string }> {
  "use step";
  const lab = await prisma.interactiveLab.findUniqueOrThrow({
    where: { id: labId },
    include: { assignment: true, versions: { orderBy: { sequence: "desc" }, take: 1 } },
  });
  const current = lab.versions[0]?.payload ? interactiveLabPayloadSchema.parse(lab.versions[0].payload) : null;
  const { entities, segments } = await loadAssignmentKnowledgeContext(lab.assignmentId);
  let reason = "Interactive Lab generation failed.";
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const payload = await generateInteractiveLab(
        instruction,
        requestedType,
        entities,
        segments,
        { courseId: lab.assignment.courseId, assignmentId: lab.assignmentId, runId: usageRunId, operation: source === "ADD" ? "interactive_lab_add" : source === "INITIAL" ? "interactive_lab_initial" : "interactive_lab_update", attempt },
        current,
        attempt === 2 ? [reason] : [],
      );
      return { payload };
    } catch (error) {
      reason = error instanceof Error ? error.message : "Interactive Lab generation failed.";
    }
  }
  return { error: reason };
}

async function finishInteractiveLabStep(
  labId: string,
  usageRunId: string,
  instruction: string,
  requestedType: InteractiveLabComponentType,
  source: "INITIAL" | "ADD" | "UPDATE",
  result: { payload?: InteractiveLabPayload; error?: string },
) {
  "use step";
  await prisma.$transaction(async (tx) => {
    const lab = await tx.interactiveLab.findUniqueOrThrow({ where: { id: labId }, include: { versions: { orderBy: { sequence: "desc" }, take: 1 } } });
    if (result.payload) {
      const version = await tx.interactiveLabVersion.create({
        data: {
          labId,
          sequence: (lab.versions[0]?.sequence ?? 0) + 1,
          source,
          instruction,
          requestedType,
          actualType: result.payload.activity.type,
          payload: json(result.payload),
        },
      });
      await tx.interactiveLab.update({ where: { id: labId }, data: { activeVersionId: version.id, approvedVersionId: null, approvedAt: null, generationStatus: "IDLE", generationError: null } });
    } else {
      await tx.interactiveLab.update({ where: { id: labId }, data: { generationStatus: "FAILED", generationError: result.error || "Interactive Lab generation failed." } });
    }
    await tx.assignment.update({ where: { id: lab.assignmentId }, data: { version: { increment: 1 } } });
  });
  await finishUsageRun(usageRunId, result.payload ? "SUCCESS" : "FAILED", result.error);
}

