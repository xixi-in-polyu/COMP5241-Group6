import { ApiError, apiError, ownedAssignment, requireTeacherApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { assignmentMaterialReadyHook } from "@/workflows/hooks";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ assignmentId: string; materialId: string }> },
) {
  try {
    const teacher = await requireTeacherApi();
    const { assignmentId, materialId } = await params;
    const assignment = await ownedAssignment(assignmentId, teacher.id);
    if (
      assignment.status !== "AWAITING_MATERIAL_FIX" ||
      !assignment.workflowHookToken?.startsWith("assignment-material-ready:")
    ) {
      throw new ApiError(409, "Assignment sources are not waiting for repair.");
    }
    const material = await prisma.assignmentMaterial.findFirst({
      where: { id: materialId, assignmentId },
    });
    if (!material) throw new ApiError(404, "Assignment material not found.");
    if (material.status !== "FAILED") {
      throw new ApiError(409, "Only failed materials can be retried.");
    }
    await prisma.assignmentMaterial.update({
      where: { id: materialId },
      data: { status: "UPLOADED", errorCode: null, errorDetail: null },
    });
    await assignmentMaterialReadyHook.resume(assignment.workflowHookToken, {
      reason: "document-retry",
    });
    return Response.json({ status: "PROCESSING" }, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}
