import { z } from "zod";
import { ApiError, apiError, ownedAssignment, requireTeacherApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({ assignmentVersion: z.number().int().nonnegative() });

export async function POST(request: Request, { params }: { params: Promise<{ assignmentId: string; labId: string }> }) {
  try {
    const teacher = await requireTeacherApi();
    const { assignmentId, labId } = await params;
    const assignment = await ownedAssignment(assignmentId, teacher.id);
    if (assignment.status !== "DRAFT") throw new ApiError(409, "Submitted assignments are locked.");
    const input = schema.parse(await request.json());
    if (input.assignmentVersion !== assignment.version) throw new ApiError(409, "Draft changed in another session.");
    const lab = await prisma.interactiveLab.findFirst({ where: { id: labId, assignmentId, archivedAt: null } });
    if (!lab) throw new ApiError(404, "Interactive Lab not found.");
    if (await prisma.interactiveLab.count({ where: { assignmentId, generationStatus: "GENERATING" } })) throw new ApiError(409, "Wait for Interactive Lab generation to finish.");
    if (!lab.activeVersionId) throw new ApiError(422, "Generate a valid Interactive Lab before approving it.");
    const activeVersionId = lab.activeVersionId;
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const changed = await tx.assignment.updateMany({ where: { id: assignmentId, version: input.assignmentVersion, status: "DRAFT" }, data: { version: { increment: 1 } } });
      if (!changed.count) throw new ApiError(409, "Draft changed in another session.");
      await tx.interactiveLab.update({ where: { id: labId }, data: { approvedVersionId: activeVersionId, approvedAt: now } });
    });
    return Response.json({ version: input.assignmentVersion + 1, approvedVersionId: activeVersionId });
  } catch (error) { return apiError(error); }
}

