import { z } from "zod";
import { ApiError, apiError, ownedAssignment, requireTeacherApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({ assignmentVersion: z.number().int().nonnegative(), action: z.enum(["archive", "restore"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ assignmentId: string; labId: string }> }) {
  try {
    const teacher = await requireTeacherApi();
    const { assignmentId, labId } = await params;
    const assignment = await ownedAssignment(assignmentId, teacher.id);
    if (assignment.status !== "DRAFT") throw new ApiError(409, "Submitted assignments are locked.");
    const input = schema.parse(await request.json());
    if (input.assignmentVersion !== assignment.version) throw new ApiError(409, "Draft changed in another session.");
    const lab = await prisma.interactiveLab.findFirst({ where: { id: labId, assignmentId } });
    if (!lab) throw new ApiError(404, "Interactive Lab not found.");
    if (lab.generationStatus === "GENERATING") throw new ApiError(409, "Wait for Interactive Lab generation to finish.");
    const active = await prisma.interactiveLab.findMany({ where: { assignmentId, archivedAt: null }, orderBy: { ordinal: "asc" }, select: { id: true, ordinal: true, generationStatus: true } });
    if (active.some((item) => item.generationStatus === "GENERATING")) throw new ApiError(409, "Wait for Interactive Lab generation to finish.");
    if (input.action === "restore" && !lab.archivedAt) throw new ApiError(409, "Interactive Lab is already active.");
    if (input.action === "archive" && lab.archivedAt) throw new ApiError(409, "Interactive Lab is already archived.");
    if (input.action === "restore" && active.length >= 3) throw new ApiError(422, "An assignment can have at most three active Interactive Labs.");
    const nextOrdinal = Math.max(-1, ...active.map((item) => item.ordinal)) + 1;
    await prisma.$transaction(async (tx) => {
      const changed = await tx.assignment.updateMany({ where: { id: assignmentId, version: input.assignmentVersion, status: "DRAFT" }, data: { version: { increment: 1 } } });
      if (!changed.count) throw new ApiError(409, "Draft changed in another session.");
      await tx.interactiveLab.update({ where: { id: labId }, data: input.action === "archive" ? { archivedAt: new Date(), approvedVersionId: null, approvedAt: null } : { archivedAt: null, ordinal: nextOrdinal, approvedVersionId: null, approvedAt: null } });
    });
    return Response.json({ version: input.assignmentVersion + 1 });
  } catch (error) { return apiError(error); }
}

