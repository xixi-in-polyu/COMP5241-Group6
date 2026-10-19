import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError, apiError, ownedAssignment, requireTeacherApi } from "@/lib/api";
import { loadAssignmentKnowledgeContext } from "@/lib/assignments/context";
import { failedSlotsSchema, questionsSchema, validateDraft } from "@/lib/assignments/domain";
import { serializeAssignment } from "@/lib/assignments/serialize";
import { prisma } from "@/lib/prisma";

const saveSchema = z.object({ version: z.number().int().nonnegative(), questions: questionsSchema });

export async function GET(_request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const teacher = await requireTeacherApi();
    const { assignmentId } = await params;
    await ownedAssignment(assignmentId, teacher.id);
    const assignment = await prisma.assignment.findUniqueOrThrow({
      where: { id: assignmentId },
      include: {
        materials: { orderBy: { createdAt: "asc" } },
        entities: { orderBy: { createdAt: "asc" } },
        questionVersions: {
          where: { status: "CANDIDATE" },
          orderBy: { createdAt: "desc" },
        },
        course: { include: { entities: true } },
      },
    });
    return Response.json({ assignment: serializeAssignment(assignment) });
  } catch (error) { return apiError(error); }
}

export async function PUT(request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const teacher = await requireTeacherApi();
    const { assignmentId } = await params;
    const assignment = await ownedAssignment(assignmentId, teacher.id);
    if (assignment.status !== "DRAFT") throw new ApiError(409, "Only draft assignments can be saved.");
    const input = saveSchema.parse(await request.json());
    const validation = validateDraft(input.questions, failedSlotsSchema.parse(assignment.failedSlots));
    if (!validation.valid) throw new ApiError(422, validation.errors.join(" "));
    const { entities } = await loadAssignmentKnowledgeContext(assignmentId);
    const entityIds = new Set(entities.map((item) => item.id));
    const evidenceIds = new Set(entities.flatMap((item) => Array.isArray(item.evidence) ? item.evidence.map((entry) => (entry as { id?: string }).id).filter(Boolean) : []));
    for (const question of input.questions) {
      if (question.entityIds.some((id) => !entityIds.has(id))) throw new ApiError(422, "A question references knowledge outside this course.");
      if (question.evidenceRefs.some((id) => !evidenceIds.has(id))) throw new ApiError(422, "A question references evidence outside this course.");
    }
    const updated = await prisma.assignment.updateMany({ where: { id: assignmentId, version: input.version, status: "DRAFT" }, data: { questions: input.questions as Prisma.InputJsonValue, version: { increment: 1 } } });
    if (!updated.count) throw new ApiError(409, "Draft changed in another session. Refresh before saving.");
    return Response.json({ version: input.version + 1 });
  } catch (error) { return apiError(error); }
}
