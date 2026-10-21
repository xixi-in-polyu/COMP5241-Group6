import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError, apiError, ownedAssignment, requireTeacherApi } from "@/lib/api";
import { interactiveLabPayloadSchema } from "@/lib/assignments/domain";
import { prisma } from "@/lib/prisma";

const schema = z.object({ assignmentVersion: z.number().int().nonnegative() });
const json = (value: unknown) => value as Prisma.InputJsonValue;

export async function POST(request: Request, { params }: { params: Promise<{ assignmentId: string; labId: string; versionId: string }> }) {
  try {
    const teacher = await requireTeacherApi();
    const { assignmentId, labId, versionId } = await params;
    const assignment = await ownedAssignment(assignmentId, teacher.id);
    if (assignment.status !== "DRAFT") throw new ApiError(409, "Submitted assignments are locked.");
    const input = schema.parse(await request.json());
    if (input.assignmentVersion !== assignment.version) throw new ApiError(409, "Draft changed in another session.");
    const lab = await prisma.interactiveLab.findFirst({ where: { id: labId, assignmentId, archivedAt: null }, include: { versions: { orderBy: { sequence: "desc" }, take: 1 } } });
    if (!lab) throw new ApiError(404, "Interactive Lab not found.");
    if (await prisma.interactiveLab.count({ where: { assignmentId, generationStatus: "GENERATING" } })) throw new ApiError(409, "Wait for Interactive Lab generation to finish.");
    const source = await prisma.interactiveLabVersion.findFirst({ where: { id: versionId, labId } });
    if (!source) throw new ApiError(404, "Interactive Lab version not found.");
    const payload = interactiveLabPayloadSchema.parse(source.payload);
    const restored = await prisma.$transaction(async (tx) => {
      const changed = await tx.assignment.updateMany({ where: { id: assignmentId, version: input.assignmentVersion, status: "DRAFT" }, data: { version: { increment: 1 } } });
      if (!changed.count) throw new ApiError(409, "Draft changed in another session.");
      const version = await tx.interactiveLabVersion.create({ data: { labId, sequence: (lab.versions[0]?.sequence ?? 0) + 1, source: "RESTORE", instruction: `Restored from v${source.sequence}`, requestedType: source.requestedType, actualType: source.actualType, payload: json(payload), restoredFromVersion: source.id } });
      await tx.interactiveLab.update({ where: { id: labId }, data: { activeVersionId: version.id, approvedVersionId: null, approvedAt: null, generationStatus: "IDLE", generationError: null } });
      return version;
    });
    return Response.json({ version: input.assignmentVersion + 1, labVersionId: restored.id });
  } catch (error) { return apiError(error); }
}

