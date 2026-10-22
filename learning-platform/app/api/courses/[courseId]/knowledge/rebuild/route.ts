import { start } from "workflow/api";

import { ApiError, apiError } from "@/lib/api";
import { checkAiLimit, startUsageRun } from "@/lib/assignments/usage";
import { assertCourseWritesEnabled, requireCourseUser, requireTeacherOwnedCourse } from "@/lib/courses/auth";
import { prisma } from "@/lib/prisma";
import { ingestionWorkflow } from "@/workflows/assignment";

export async function POST(_request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    assertCourseWritesEnabled();
    const user = await requireCourseUser();
    const { courseId } = await params;
    await requireTeacherOwnedCourse(courseId, user);
    const sources = await prisma.sourceSegment.count({ where: { courseId } });
    if (!sources) throw new ApiError(422, "Add at least one ready text source before rebuilding knowledge.");
    const limit = await checkAiLimit(user.id, courseId);
    if (!limit.allowed) throw new ApiError(429, `AI ${limit.windowKind} limit reached.`);
    const usage = await startUsageRun(courseId, user.id, "knowledge_rebuild");
    const workflow = await start(ingestionWorkflow, [courseId, usage.id]);
    return Response.json({ runId: workflow.runId }, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}
