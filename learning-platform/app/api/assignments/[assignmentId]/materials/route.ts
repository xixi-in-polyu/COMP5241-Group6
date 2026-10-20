import { z } from "zod";
import { ApiError, apiError, ownedAssignment, requireTeacherApi } from "@/lib/api";
import { validateAssignmentSourceSelection } from "@/lib/assignments/staged";
import { validateMaterialMetadata } from "@/lib/materials/parsers";
import { validateTranscriptMetadata } from "@/lib/materials/subtitles";
import { prisma } from "@/lib/prisma";
import { assignmentMaterialReadyHook } from "@/workflows/hooks";

const fileSchema = z.object({
  kind: z.enum(["FILE", "TRANSCRIPT"]),
  name: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1),
  size: z.number().int().positive().max(20 * 1024 * 1024),
  blobPathname: z.string().trim().min(1),
});
const schema = fileSchema;

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
      throw new ApiError(409, "Assignment sources are not waiting for repair.");
    }
    const input = schema.parse(await request.json());
    const current = await prisma.assignmentMaterial.findMany({
      where: { assignmentId },
      select: { kind: true, status: true, size: true },
    });
    validateAssignmentSourceSelection([
      ...current,
      { kind: input.kind, status: "UPLOADED", size: "size" in input ? input.size : undefined },
    ]);
    const prefix = `learning-platform/courses/${assignment.courseId}/assignments/${assignmentId}/`;
    if (!input.blobPathname.startsWith(prefix)) {
      throw new ApiError(422, "Invalid assignment Blob path.");
    }
    if (input.kind === "TRANSCRIPT") {
      validateTranscriptMetadata(input.name, input.mimeType, input.size);
    } else {
      validateMaterialMetadata(input.name, input.mimeType, input.size);
    }
    await prisma.assignmentMaterial.create({
      data: { assignmentId, ...input },
    });
    await assignmentMaterialReadyHook.resume(assignment.workflowHookToken, {
      reason: input.kind === "TRANSCRIPT" ? "transcript-added" : "material-replaced",
    });
    return Response.json({ status: "PROCESSING" }, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}
