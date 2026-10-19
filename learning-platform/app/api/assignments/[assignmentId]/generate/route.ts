import { Prisma } from "@prisma/client";
import { start } from "workflow/api";
import { ApiError, apiError, ownedAssignment, requireTeacherApi } from "@/lib/api";
import { isAiConfigured } from "@/lib/assignments/ai";
import { briefSchema } from "@/lib/assignments/domain";
import { checkAiLimit, startUsageRun } from "@/lib/assignments/usage";
import { prisma } from "@/lib/prisma";
import { generationWorkflow } from "@/workflows/assignment";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  try {
    const teacher = await requireTeacherApi();
    const { assignmentId } = await params;
    const assignment = await ownedAssignment(assignmentId, teacher.id);
    if (!isAiConfigured()) {
      return Response.json({ error: "AI provider is not configured." }, { status: 503 });
    }
    if (assignment.status !== "READY_TO_GENERATE") {
      throw new ApiError(409, "Confirm assignment knowledge before generating.");
    }
    const brief = briefSchema.parse(await request.json());
    const selected = await prisma.assignmentKnowledgeEntity.findMany({
      where: { assignmentId, selected: true },
      select: { id: true },
    });
    const ids = new Set(selected.map((entity) => entity.id));
    if (
      brief.coverageEntityIds.length &&
      brief.coverageEntityIds.some((id) => !ids.has(id))
    ) {
      throw new ApiError(422, "Brief coverage must use selected assignment knowledge.");
    }
    const limit = await checkAiLimit(teacher.id, assignment.courseId);
    if (!limit.allowed) {
      return Response.json(
        { error: "AI usage limit reached." },
        { status: 429, headers: { "retry-after": String(limit.retryAfter) } },
      );
    }
    const changed = await prisma.assignment.updateMany({
      where: { id: assignmentId, status: "READY_TO_GENERATE" },
      data: {
        status: "GENERATING",
        phase: "Generating grounded questions",
        originalBrief: brief as Prisma.InputJsonValue,
        error: null,
      },
    });
    if (!changed.count) throw new ApiError(409, "Assignment state changed.");
    const run = await startUsageRun(
      assignment.courseId,
      teacher.id,
      "generation",
      assignmentId,
    );
    const workflow = await start(generationWorkflow, [assignmentId, run.id]);
    return Response.json({ runId: workflow.runId }, { status: 202 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return apiError(new ApiError(409, "This course already has an active assignment workflow."));
    }
    return apiError(error);
  }
}
