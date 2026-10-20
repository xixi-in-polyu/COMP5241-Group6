import { start } from "workflow/api";
import { ApiError, apiError, ownedCourse, requireTeacherApi } from "@/lib/api";
import { startUsageRun } from "@/lib/assignments/usage";
import { prisma } from "@/lib/prisma";
import { ingestionWorkflow } from "@/workflows/assignment";

export async function POST(_request: Request, { params }: { params: Promise<{ courseId: string; materialId: string }> }) {
  try {
    const teacher = await requireTeacherApi();
    const { courseId, materialId } = await params;
    const course = await ownedCourse(courseId, teacher.id);
    if (course.status !== "AWAITING_MATERIAL_FIX") throw new ApiError(409, "Materials cannot be retried in the current state.");
    const material = await prisma.courseMaterial.findFirst({ where: { id: materialId, courseId } });
    if (!material) throw new ApiError(404, "Material not found.");
    await prisma.$transaction([
      prisma.courseMaterial.update({ where: { id: materialId }, data: { status: "UPLOADED", errorCode: null, errorDetail: null } }),
      prisma.course.update({ where: { id: courseId }, data: { status: "INGESTING", phase: "Retrying source material" } }),
    ]);
    const run = await startUsageRun(courseId, teacher.id, "ingestion");
    const workflow = await start(ingestionWorkflow, [courseId, run.id]);
    return Response.json({ runId: workflow.runId }, { status: 202 });
  } catch (error) { return apiError(error); }
}
