import { z } from "zod";
import { ApiError, apiError, ownedAssignment, requireTeacherApi } from "@/lib/api";
import { validateMaterialMetadata } from "@/lib/materials/parsers";
import { validateTranscriptMetadata } from "@/lib/materials/subtitles";
import { prisma } from "@/lib/prisma";
import { assignmentMaterialReadyHook } from "@/workflows/hooks";

const replacementSchema = z.object({
  kind: z.enum(["FILE", "TRANSCRIPT"]),
  name: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1),
  size: z.number().int().positive().max(20 * 1024 * 1024),
  blobPathname: z.string().trim().min(1),
});

async function repairableAssignment(assignmentId: string, teacherId: string) {
  const assignment = await ownedAssignment(assignmentId, teacherId);
  if (
    assignment.status !== "AWAITING_MATERIAL_FIX" ||
    !assignment.workflowHookToken?.startsWith("assignment-material-ready:")
  ) {
    throw new ApiError(409, "Assignment sources are not waiting for repair.");
  }
  return assignment;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ assignmentId: string; materialId: string }> },
) {
  try {
    const teacher = await requireTeacherApi();
    const { assignmentId, materialId } = await params;
    const assignment = await repairableAssignment(assignmentId, teacher.id);
    const input = replacementSchema.parse(await request.json());
    const prefix = `learning-platform/courses/${assignment.courseId}/assignments/${assignmentId}/`;
    if (!input.blobPathname.startsWith(prefix)) {
      throw new ApiError(422, "Invalid assignment Blob path.");
    }
    if (input.kind === "TRANSCRIPT") {
      validateTranscriptMetadata(input.name, input.mimeType, input.size);
    } else {
      validateMaterialMetadata(input.name, input.mimeType, input.size);
    }
    const material = await prisma.assignmentMaterial.findFirst({
      where: { id: materialId, assignmentId },
    });
    if (!material) throw new ApiError(404, "Assignment material not found.");
    await prisma.assignmentMaterial.update({
      where: { id: materialId },
      data: {
        ...input,
        status: "UPLOADED",
        pageCount: null,
        errorCode: null,
        errorDetail: null,
      },
    });
    await assignmentMaterialReadyHook.resume(assignment.workflowHookToken!, {
      reason: "material-replaced",
    });
    return Response.json({ status: "PROCESSING" }, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ assignmentId: string; materialId: string }> },
) {
  try {
    const teacher = await requireTeacherApi();
    const { assignmentId, materialId } = await params;
    const assignment = await repairableAssignment(assignmentId, teacher.id);
    const removed = await prisma.assignmentMaterial.deleteMany({
      where: { id: materialId, assignmentId },
    });
    if (!removed.count) throw new ApiError(404, "Assignment material not found.");
    await assignmentMaterialReadyHook.resume(assignment.workflowHookToken!, {
      reason: "material-removed",
    });
    return Response.json({ status: "PROCESSING" }, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}
