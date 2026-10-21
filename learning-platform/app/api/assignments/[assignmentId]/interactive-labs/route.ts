import { Prisma } from "@prisma/client";
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

export async function POST(request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  let runId: string | undefined;
  let labId: string | undefined;
  try {
    const teacher = await requireTeacherApi();
    const { assignmentId } = await params;
    const assignment = await ownedAssignment(assignmentId, teacher.id);
    if (!isAiConfigured()) return Response.json({ error: "AI provider is not configured." }, { status: 503 });
    if (assignment.status !== "DRAFT") throw new ApiError(409, "Only draft assignments can add Interactive Labs.");
    const input = schema.parse(await request.json());
    if (assignment.version !== input.assignmentVersion) throw new ApiError(409, "Draft changed in another session.");
    const active = await prisma.interactiveLab.findMany({ where: { assignmentId, archivedAt: null }, select: { ordinal: true, generationStatus: true } });
    if (active.length >= 3) throw new ApiError(422, "An assignment can have at most three active Interactive Labs.");
    if (active.some((lab) => lab.generationStatus === "GENERATING")) throw new ApiError(409, "Another Interactive Lab is already generating for this assignment.");
    const limit = await checkAiLimit(teacher.id, assignment.courseId);
    if (!limit.allowed) return Response.json({ error: "AI usage limit reached." }, { status: 429, headers: { "retry-after": String(limit.retryAfter) } });
    const run = await startUsageRun(assignment.courseId, teacher.id, "interactive_lab_add", assignmentId); runId = run.id;
    const created = await prisma.$transaction(async (tx) => {
      const changed = await tx.assignment.updateMany({ where: { id: assignmentId, version: input.assignmentVersion, status: "DRAFT" }, data: { version: { increment: 1 } } });
      if (!changed.count) throw new ApiError(409, "Draft changed in another session.");
      return tx.interactiveLab.create({ data: { assignmentId, ordinal: Math.max(-1, ...active.map((lab) => lab.ordinal)) + 1, generationStatus: "GENERATING" } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    labId = created.id;
    const workflow = await start(interactiveLabGenerationWorkflow, [created.id, run.id, input.instruction, input.componentType, "ADD"]);
    return Response.json({ labId: created.id, runId: workflow.runId, version: input.assignmentVersion + 1 }, { status: 202 });
  } catch (error) {
    if (runId && labId) await prisma.interactiveLab.update({ where: { id: labId }, data: { generationStatus: "FAILED", generationError: error instanceof Error ? error.message : "Could not start generation." } }).catch(() => undefined);
    if (runId) await finishUsageRun(runId, "FAILED", error instanceof Error ? error.message : "Could not start generation.").catch(() => undefined);
    return apiError(labConflict(error));
  }
}

