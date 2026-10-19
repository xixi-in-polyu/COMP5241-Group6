import { Prisma } from "@prisma/client";
import { start } from "workflow/api";
import { z } from "zod";
import { ApiError, apiError, ownedAssignment, requireTeacherApi } from "@/lib/api";
import { isAiConfigured } from "@/lib/assignments/ai";
import { failedSlotsSchema } from "@/lib/assignments/domain";
import { checkAiLimit, startUsageRun } from "@/lib/assignments/usage";
import { prisma } from "@/lib/prisma";
import { retryFailedSlot } from "@/workflows/assignment";

export async function POST(_request: Request, { params }: { params: Promise<{ assignmentId: string; slotIndex: string }> }) {
  try {
    const teacher = await requireTeacherApi();
    const { assignmentId, slotIndex } = await params;
    const assignment = await ownedAssignment(assignmentId, teacher.id);
    if (!isAiConfigured()) return Response.json({ error: "AI provider is not configured." }, { status: 503 });
    if (assignment.status !== "DRAFT") throw new ApiError(409, "Submitted assignments are locked.");
    const index = z.coerce.number().int().nonnegative().parse(slotIndex);
    const slot = failedSlotsSchema.parse(assignment.failedSlots).find((item) => item.index === index);
    if (!slot) throw new ApiError(404, "Failed slot not found.");
    const limit = await checkAiLimit(teacher.id, assignment.courseId);
    if (!limit.allowed) return Response.json({ error: "AI usage limit reached." }, { status: 429, headers: { "retry-after": String(limit.retryAfter) } });
    await prisma.assignmentSlotLease.deleteMany({ where: { assignmentId, slotIndex: index, expiresAt: { lt: new Date() } } });
    try { await prisma.assignmentSlotLease.create({ data: { assignmentId, slotIndex: index, expiresAt: new Date(Date.now() + 30 * 60_000) } }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ApiError(409, "This slot is already being retried."); throw error; }
    const run = await startUsageRun(assignment.courseId, teacher.id, "slot_retry", assignmentId);
    const workflow = await start(retryFailedSlot, [assignmentId, run.id, { index: slot.index, type: slot.type, objective: slot.objective, difficulty: slot.difficulty, entityIds: slot.entityIds, score: slot.score }]);
    return Response.json({ runId: workflow.runId }, { status: 202 });
  } catch (error) { return apiError(error); }
}
