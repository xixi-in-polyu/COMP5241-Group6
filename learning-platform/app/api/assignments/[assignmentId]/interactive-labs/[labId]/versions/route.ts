import { start } from "workflow/api";
import { z } from "zod";
import { ApiError, apiError, ownedAssignment, requireTeacherApi } from "@/lib/api";
import { isAiConfigured } from "@/lib/assignments/ai";
import { interactiveLabComponentTypeSchema } from "@/lib/assignments/domain";
import { labConflict } from "@/lib/assignments/lab-route";
import { checkAiLimit, finishUsageRun, startUsageRun } from "@/lib/assignments/usage";
import { prisma } from "@/lib/prisma";
import { interactiveLabGenerationWorkflow } from "@/workflows/interactive-lab";

const schema = z.object({ assignmentVersion: z.number().int().nonnegative(), instruction: z.string().trim().min(1).max(4_000), componentType: interactiveLabComponentTypeSchema });

export async function GET(_request: Request, { params }: { params: Promise<{ assignmentId: string; labId: string }> }) {
  try {
    const teacher = await requireTeacherApi();
    const { assignmentId, labId } = await params;
    await ownedAssignment(assignmentId, teacher.id);
    const lab = await prisma.interactiveLab.findFirst({ where: { id: labId, assignmentId } });
    if (!lab) throw new ApiError(404, "Interactive Lab not found.");
    const versions = await prisma.interactiveLabVersion.findMany({ where: { labId }, orderBy: { sequence: "desc" }, select: { id: true, sequence: true, source: true, instruction: true, requestedType: true, actualType: true, restoredFromVersion: true, createdAt: true } });
    return Response.json({ versions });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ assignmentId: string; labId: string }> }) {
  let runId: string | undefined;
  try {
    const teacher = await requireTeacherApi();
    const { assignmentId, labId } = await params;
    const assignment = await ownedAssignment(assignmentId, teacher.id);
    if (!isAiConfigured()) return Response.json({ error: "AI provider is not configured." }, { status: 503 });
    if (assignment.status !== "DRAFT") throw new ApiError(409, "Only draft Interactive Labs can be updated.");
    const input = schema.parse(await request.json());
    if (assignment.version !== input.assignmentVersion) throw new ApiError(409, "Draft changed in another session.");
    const lab = await prisma.interactiveLab.findFirst({ where: { id: labId, assignmentId, archivedAt: null } });
    if (!lab) throw new ApiError(404, "Interactive Lab not found.");
    const limit = await checkAiLimit(teacher.id, assignment.courseId);
    if (!limit.allowed) return Response.json({ error: "AI usage limit reached." }, { status: 429, headers: { "retry-after": String(limit.retryAfter) } });
    const run = await startUsageRun(assignment.courseId, teacher.id, "interactive_lab_update", assignmentId); runId = run.id;
    await prisma.$transaction(async (tx) => {
      const changed = await tx.assignment.updateMany({ where: { id: assignmentId, version: input.assignmentVersion, status: "DRAFT" }, data: { version: { increment: 1 } } });
      if (!changed.count) throw new ApiError(409, "Draft changed in another session.");
      const claimed = await tx.interactiveLab.updateMany({ where: { id: labId, assignmentId, archivedAt: null, generationStatus: { not: "GENERATING" } }, data: { generationStatus: "GENERATING", generationError: null } });
      if (!claimed.count) throw new ApiError(409, "This Interactive Lab is already generating.");
    });
    const workflow = await start(interactiveLabGenerationWorkflow, [labId, run.id, input.instruction, input.componentType, "UPDATE"]);
    return Response.json({ runId: workflow.runId, version: input.assignmentVersion + 1 }, { status: 202 });
  } catch (error) {
    if (runId) {
      const { labId } = await params;
      await prisma.interactiveLab.updateMany({ where: { id: labId, generationStatus: "GENERATING" }, data: { generationStatus: "FAILED", generationError: error instanceof Error ? error.message : "Could not start generation." } }).catch(() => undefined);
      await finishUsageRun(runId, "FAILED", error instanceof Error ? error.message : "Could not start generation.").catch(() => undefined);
    }
    return apiError(labConflict(error));
  }
}

