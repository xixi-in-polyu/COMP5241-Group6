import { z } from "zod";
import { ApiError, apiError, ownedAssignment, requireTeacherApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({ assignmentVersion: z.number().int().nonnegative(), labIds: z.array(z.string().uuid()).max(3) });

export async function PUT(request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const teacher = await requireTeacherApi();
    const { assignmentId } = await params;
    const assignment = await ownedAssignment(assignmentId, teacher.id);
    if (assignment.status !== "DRAFT") throw new ApiError(409, "Submitted assignments are locked.");
    const input = schema.parse(await request.json());
    if (input.assignmentVersion !== assignment.version) throw new ApiError(409, "Draft changed in another session.");
    if (new Set(input.labIds).size !== input.labIds.length) throw new ApiError(422, "Interactive Lab order contains duplicates.");
    const active = await prisma.interactiveLab.findMany({ where: { assignmentId, archivedAt: null }, select: { id: true, generationStatus: true } });
    if (active.some((lab) => lab.generationStatus === "GENERATING")) throw new ApiError(409, "Wait for Interactive Lab generation to finish.");
    if (active.length !== input.labIds.length || active.some((lab) => !input.labIds.includes(lab.id))) throw new ApiError(422, "Interactive Lab order must include every active Lab exactly once.");
    await prisma.$transaction(async (tx) => {
      const changed = await tx.assignment.updateMany({ where: { id: assignmentId, version: input.assignmentVersion, status: "DRAFT" }, data: { version: { increment: 1 } } });
      if (!changed.count) throw new ApiError(409, "Draft changed in another session.");
      await Promise.all(input.labIds.map((id, ordinal) => tx.interactiveLab.update({ where: { id }, data: { ordinal } })));
    });
    return Response.json({ version: input.assignmentVersion + 1 });
  } catch (error) { return apiError(error); }
}

