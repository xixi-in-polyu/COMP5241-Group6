import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError, apiError, ownedAssignment, requireTeacherApi } from "@/lib/api";
import { entitySchema } from "@/lib/assignments/domain";
import { prisma } from "@/lib/prisma";

const inputSchema = z.object({
  revision: z.number().int().nonnegative(),
  entities: z.array(entitySchema).min(1),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  try {
    const teacher = await requireTeacherApi();
    const { assignmentId } = await params;
    const assignment = await ownedAssignment(assignmentId, teacher.id);
    if (assignment.status !== "AWAITING_ENTITY_REVIEW") {
      throw new ApiError(409, "Knowledge is not editable in the current assignment state.");
    }
    const input = inputSchema.parse(await request.json());
    if (input.revision !== assignment.entityRevision) {
      throw new ApiError(409, "Knowledge changed in another session.");
    }
    const ids = new Set(input.entities.map((entity) => entity.id));
    if (input.entities.some((entity) => entity.parentId && !ids.has(entity.parentId))) {
      throw new ApiError(422, "Every parent must refer to assignment knowledge.");
    }
    const parents = new Map(
      input.entities.map((entity) => [entity.id, entity.parentId]),
    );
    for (const entity of input.entities) {
      const seen = new Set<string>();
      let cursor: string | null | undefined = entity.id;
      while (cursor) {
        if (seen.has(cursor)) {
          throw new ApiError(422, "Knowledge hierarchy cannot contain a cycle.");
        }
        seen.add(cursor);
        cursor = parents.get(cursor);
      }
    }
    if (!input.entities.some((entity) => entity.selected)) {
      throw new ApiError(422, "Select at least one knowledge entity.");
    }
    const [courseSegments, assignmentSegments] = await Promise.all([
      prisma.sourceSegment.findMany({
        where: { courseId: assignment.courseId },
        select: { id: true, materialId: true, normalizedText: true },
      }),
      prisma.assignmentSourceSegment.findMany({
        where: { assignmentId },
        select: { id: true, materialId: true, normalizedText: true },
      }),
    ]);
    const segments = new Map(
      [...courseSegments, ...assignmentSegments].map((segment) => [
        segment.id,
        segment,
      ]),
    );
    for (const entity of input.entities) {
      for (const evidence of entity.evidence) {
        const segment = segments.get(evidence.segmentId);
        if (
          !segment ||
          segment.materialId !== evidence.materialId ||
          !segment.normalizedText.includes(evidence.quote)
        ) {
          throw new ApiError(422, "Evidence must be an exact assignment-context quote.");
        }
      }
    }
    await prisma.$transaction(async (tx) => {
      const locked = await tx.assignment.updateMany({
        where: {
          id: assignmentId,
          entityRevision: input.revision,
          status: "AWAITING_ENTITY_REVIEW",
        },
        data: { entityRevision: { increment: 1 } },
      });
      if (!locked.count) throw new ApiError(409, "Knowledge changed in another session.");
      await tx.assignmentKnowledgeEntity.deleteMany({ where: { assignmentId } });
      await tx.assignmentKnowledgeEntity.createMany({
        data: input.entities.map((entity) => ({
          id: entity.id,
          assignmentId,
          parentId: entity.parentId,
          name: entity.name,
          description: entity.description,
          aliases: entity.aliases as Prisma.InputJsonValue,
          importance: entity.importance,
          selected: entity.selected,
          evidence: entity.evidence as Prisma.InputJsonValue,
        })),
      });
    }, { maxWait: 10_000, timeout: 30_000 });
    return Response.json({ revision: assignment.entityRevision + 1 });
  } catch (error) {
    return apiError(error);
  }
}
