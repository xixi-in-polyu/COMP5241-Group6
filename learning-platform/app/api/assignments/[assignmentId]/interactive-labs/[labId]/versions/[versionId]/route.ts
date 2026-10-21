import { ApiError, apiError, ownedAssignment, requireTeacherApi } from "@/lib/api";
import { interactiveLabPayloadSchema } from "@/lib/assignments/domain";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ assignmentId: string; labId: string; versionId: string }> }) {
  try {
    const teacher = await requireTeacherApi();
    const { assignmentId, labId, versionId } = await params;
    await ownedAssignment(assignmentId, teacher.id);
    const version = await prisma.interactiveLabVersion.findFirst({ where: { id: versionId, labId, lab: { assignmentId } } });
    if (!version) throw new ApiError(404, "Interactive Lab version not found.");
    return Response.json({ version: { ...version, payload: interactiveLabPayloadSchema.parse(version.payload) } });
  } catch (error) { return apiError(error); }
}

