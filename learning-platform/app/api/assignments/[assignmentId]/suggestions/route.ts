import { z } from "zod";
import { ApiError, apiError, ownedAssignment, requireTeacherApi } from "@/lib/api";
import { isAiConfigured, suggestBrief } from "@/lib/assignments/ai";
import { loadAssignmentKnowledgeContext } from "@/lib/assignments/context";
import { checkAiLimit, finishUsageRun, startUsageRun } from "@/lib/assignments/usage";

const schema = z.object({ instructions: z.string().trim().min(1).max(4_000) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  let runId: string | undefined;
  try {
    const teacher = await requireTeacherApi();
    const { assignmentId } = await params;
    const assignment = await ownedAssignment(assignmentId, teacher.id);
    if (!isAiConfigured()) {
      return Response.json({ error: "AI provider is not configured." }, { status: 503 });
    }
    if (assignment.status !== "READY_TO_GENERATE") {
      throw new ApiError(409, "Suggestions are available during the Brief step.");
    }
    const input = schema.parse(await request.json());
    const limit = await checkAiLimit(teacher.id, assignment.courseId);
    if (!limit.allowed) {
      return Response.json(
        { error: "AI usage limit reached." },
        { status: 429, headers: { "retry-after": String(limit.retryAfter) } },
      );
    }
    const { entities } = await loadAssignmentKnowledgeContext(assignmentId);
    const run = await startUsageRun(
      assignment.courseId,
      teacher.id,
      "requirements_suggestion",
      assignmentId,
    );
    runId = run.id;
    const suggestions = await suggestBrief(input.instructions, entities, {
      courseId: assignment.courseId,
      assignmentId,
      runId,
      operation: "requirements_suggestion",
    });
    await finishUsageRun(runId, "SUCCESS");
    return Response.json({ suggestions });
  } catch (error) {
    if (runId) {
      await finishUsageRun(
        runId,
        "FAILED",
        error instanceof Error ? error.message : "Suggestion failed.",
      ).catch(() => undefined);
    }
    return apiError(error);
  }
}
