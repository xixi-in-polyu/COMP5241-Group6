import { start } from "workflow/api";

import { ApiError, apiError } from "@/lib/api";
import { checkAiLimit, finishUsageRun, startUsageRun } from "@/lib/assignments/usage";
import { assertCourseWritesEnabled, requireCourseUser, requireTeacherOwnedCourse } from "@/lib/courses/auth";
import { prisma } from "@/lib/prisma";
import { ingestionWorkflow } from "@/workflows/assignment";

export async function POST(_request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    assertCourseWritesEnabled();
    const user = await requireCourseUser();
    const { courseId } = await params;
    const course = await requireTeacherOwnedCourse(courseId, user);
    if (["INGESTING", "EXTRACTING_ENTITIES"].includes(course.status)) {
      throw new ApiError(409, "Knowledge is already being rebuilt.");
    }
    const sources = await prisma.sourceSegment.count({ where: { courseId } });
    if (!sources) throw new ApiError(422, "Add at least one ready text source before rebuilding knowledge.");

    // Claim the course before creating usage records or starting the workflow.
    // The status comparison makes concurrent rebuild requests mutually exclusive.
    const claimed = await prisma.course.updateMany({
      where: { id: courseId, status: course.status },
      data: { status: "INGESTING", phase: "Starting knowledge rebuild", error: null },
    });
    if (!claimed.count) throw new ApiError(409, "Knowledge is already being rebuilt.");

    let usageId: string | undefined;
    try {
      const limit = await checkAiLimit(user.id, courseId);
      if (!limit.allowed) throw new ApiError(429, `AI ${limit.windowKind} limit reached.`);
      const usage = await startUsageRun(courseId, user.id, "knowledge_rebuild");
      usageId = usage.id;
      const workflow = await start(ingestionWorkflow, [courseId, usage.id]);
      return Response.json({ runId: workflow.runId }, { status: 202 });
    } catch (error) {
      await prisma.course.updateMany({
        where: { id: courseId, status: "INGESTING", phase: "Starting knowledge rebuild" },
        data: { status: course.status, phase: course.phase, error: course.error },
      });
      if (usageId) {
        await finishUsageRun(
          usageId,
          "FAILED",
          error instanceof Error ? error.message : "Could not start knowledge rebuild.",
        );
      }
      throw error;
    }
  } catch (error) {
    return apiError(error);
  }
}
