import { z } from "zod";
import { ApiError, apiError, ownedAssignment, requireTeacherApi } from "@/lib/api";
import { validateTranscriptMetadata } from "@/lib/materials/subtitles";
import { prisma } from "@/lib/prisma";
import { assignmentMaterialReadyHook } from "@/workflows/hooks";

const schema = z.object({
  materialId: z.string().uuid(),
  name: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1),
  size: z.number().int().positive().max(20 * 1024 * 1024),
  blobPathname: z.string().trim().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  try {
    const teacher = await requireTeacherApi();
    const { assignmentId } = await params;
    const assignment = await ownedAssignment(assignmentId, teacher.id);
    if (
      assignment.status !== "AWAITING_MATERIAL_FIX" ||
      !assignment.workflowHookToken?.startsWith("assignment-material-ready:")
    ) {
      throw new ApiError(409, "Assignment sources are not waiting for a transcript.");
    }
    const input = schema.parse(await request.json());
    const prefix = `learning-platform/courses/${assignment.courseId}/assignments/${assignmentId}/`;
    if (!input.blobPathname.startsWith(prefix)) {
      throw new ApiError(422, "Invalid assignment Blob path.");
    }
    validateTranscriptMetadata(input.name, input.mimeType, input.size);
    const video = await prisma.assignmentMaterial.findFirst({
      where: {
        id: input.materialId,
        assignmentId,
        kind: "VIDEO",
        status: { in: ["FAILED", "NEEDS_INPUT"] },
      },
    });
    if (!video) throw new ApiError(404, "Failed YouTube material not found.");
    await prisma.assignmentMaterial.update({
      where: { id: video.id },
      data: {
        kind: "TRANSCRIPT",
        name: input.name,
        mimeType: input.mimeType,
        size: input.size,
        blobPathname: input.blobPathname,
        sourceUrl: null,
        status: "UPLOADED",
        durationSeconds: null,
        captionMode: null,
        errorCode: null,
        errorDetail: null,
      },
    });
    await assignmentMaterialReadyHook.resume(assignment.workflowHookToken, {
      reason: "transcript-added",
    });
    return Response.json({ status: "PROCESSING" }, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}
