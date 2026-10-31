import { authorizeApiRole } from "@/lib/auth/authorization";
import { interactiveLabPayloadSchema } from "@/lib/assignments/domain";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  const authorization = await authorizeApiRole("student");
  if (authorization.response) return authorization.response;
  const { assignmentId } = await params;
  const assignment = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      status: "SUBMITTED",
      course: {
        status: "READY",
        publicationStatus: "PUBLISHED",
        archivedAt: null,
      },
    },
    select: {
      id: true,
      title: true,
      course: { select: { id: true, title: true } },
      interactiveLabs: {
        where: { archivedAt: null },
        orderBy: { ordinal: "asc" },
        include: { versions: true },
      },
    },
  });
  if (!assignment) return Response.json({ error: "Assignment not found." }, { status: 404 });

  const labs = assignment.interactiveLabs.flatMap((lab) => {
    if (!lab.activeVersionId || lab.approvedVersionId !== lab.activeVersionId) return [];
    const version = lab.versions.find((item) => item.id === lab.activeVersionId);
    if (!version) return [];
    const parsed = interactiveLabPayloadSchema.safeParse(version.payload);
    if (!parsed.success) return [];
    const { entityIds: _entityIds, evidenceRefs: _evidenceRefs, ...activity } = parsed.data.activity;
    void _entityIds;
    void _evidenceRefs;
    return [{
      id: lab.id,
      ordinal: lab.ordinal,
      versionId: version.id,
      version: version.sequence,
      type: version.actualType,
      payload: { schemaVersion: 1 as const, activity },
    }];
  });
  if (!labs.length) return Response.json({ error: "No approved Interactive Labs are available." }, { status: 404 });
  return Response.json({ studentId: authorization.user.id, assignment: { id: assignment.id, title: assignment.title, course: assignment.course }, labs });
}
