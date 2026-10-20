import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError, apiError, ownedAssignment, requireTeacherApi } from "@/lib/api";
import { isAiConfigured, regenerateQuestion, validateGroundedQuestion } from "@/lib/assignments/ai";
import { loadAssignmentKnowledgeContext } from "@/lib/assignments/context";
import { questionsSchema } from "@/lib/assignments/domain";
import { checkAiLimit, finishUsageRun, startUsageRun } from "@/lib/assignments/usage";
import { prisma } from "@/lib/prisma";

const schema = z.object({ instruction: z.string().trim().min(1).max(1_000) });
export async function POST(request: Request, { params }: { params: Promise<{ assignmentId: string; questionId: string }> }) {
  let runId: string | undefined;
  try {
    const teacher = await requireTeacherApi();
    const { assignmentId, questionId } = await params;
    const assignment = await ownedAssignment(assignmentId, teacher.id);
    if (!isAiConfigured()) return Response.json({ error: "AI provider is not configured." }, { status: 503 });
    if (assignment.status !== "DRAFT") throw new ApiError(409, "Submitted assignments are locked.");
    const input = schema.parse(await request.json());
    const current = questionsSchema.parse(assignment.questions).find((item) => item.id === questionId);
    if (!current) throw new ApiError(404, "Question not found.");
    const limit = await checkAiLimit(teacher.id, assignment.courseId);
    if (!limit.allowed) return Response.json({ error: "AI usage limit reached." }, { status: 429, headers: { "retry-after": String(limit.retryAfter) } });
    const { entities, segments } = await loadAssignmentKnowledgeContext(assignmentId);
    const run = await startUsageRun(assignment.courseId, teacher.id, "question_regeneration", assignmentId); runId = run.id;
    const candidate = await regenerateQuestion(current, input.instruction, entities, segments, { courseId: assignment.courseId, assignmentId, runId, operation: "question_regeneration" });
    const diagnostics = validateGroundedQuestion(candidate, { index: 0, type: current.type, objective: current.objective, difficulty: current.difficulty, entityIds: current.entityIds, score: current.score }, entities, segments);
    if (diagnostics.length) throw new ApiError(422, `Candidate failed validation: ${diagnostics.join(" ")}`);
    const version = await prisma.questionVersion.create({ data: { assignmentId, questionId, instruction: input.instruction, payload: candidate as Prisma.InputJsonValue } });
    await finishUsageRun(runId, "SUCCESS");
    return Response.json({ candidate: version });
  } catch (error) {
    if (runId) await finishUsageRun(runId, "FAILED", error instanceof Error ? error.message : "Regeneration failed.").catch(() => undefined);
    return apiError(error);
  }
}

const resolveSchema = z.object({ action: z.enum(["accept", "reject"]), version: z.number().int().nonnegative() });
export async function PATCH(request: Request, { params }: { params: Promise<{ assignmentId: string; questionId: string }> }) {
  try {
    const teacher = await requireTeacherApi();
    const { assignmentId, questionId } = await params;
    const assignment = await ownedAssignment(assignmentId, teacher.id);
    if (assignment.status !== "DRAFT") throw new ApiError(409, "Submitted assignments are locked.");
    const input = resolveSchema.parse(await request.json());
    if (input.version !== assignment.version) throw new ApiError(409, "Draft changed in another session.");
    const candidate = await prisma.questionVersion.findFirst({ where: { assignmentId, questionId, status: "CANDIDATE" }, orderBy: { createdAt: "desc" } });
    if (!candidate) throw new ApiError(404, "Candidate not found.");
    const questions = questionsSchema.parse(assignment.questions);
    await prisma.$transaction(async (tx) => {
      if (input.action === "accept") {
        const changed = await tx.assignment.updateMany({ where: { id: assignmentId, version: input.version, status: "DRAFT" }, data: { questions: questions.map((item) => item.id === questionId ? candidate.payload : item) as Prisma.InputJsonValue, version: { increment: 1 } } });
        if (!changed.count) throw new ApiError(409, "Draft changed in another session.");
      }
      await tx.questionVersion.update({ where: { id: candidate.id }, data: { status: input.action === "accept" ? "ACCEPTED" : "REJECTED", resolvedAt: new Date() } });
    });
    return Response.json({ version: input.action === "accept" ? assignment.version + 1 : assignment.version });
  } catch (error) { return apiError(error); }
}
