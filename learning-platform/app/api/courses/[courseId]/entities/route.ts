import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError, apiError, ownedCourse, requireTeacherApi } from "@/lib/api";
import { entitySchema } from "@/lib/assignments/domain";
import { prisma } from "@/lib/prisma";

const inputSchema = z.object({ revision: z.number().int().nonnegative(), entities: z.array(entitySchema).min(1) });

export async function PUT(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const teacher = await requireTeacherApi();
    const { courseId } = await params;
    const course = await ownedCourse(courseId, teacher.id);
    if (course.status !== "AWAITING_ENTITY_REVIEW") throw new ApiError(409, "Knowledge is not editable in the current course state.");
    const input = inputSchema.parse(await request.json());
    if (input.revision !== course.entityRevision) throw new ApiError(409, "Knowledge changed in another session. Refresh before saving.");
    const ids = new Set(input.entities.map((item) => item.id));
    if (input.entities.some((item) => item.parentId && !ids.has(item.parentId))) throw new ApiError(422, "Every parent must refer to an entity in this course.");
    const parents = new Map(input.entities.map((item) => [item.id, item.parentId]));
    for (const entity of input.entities) {
      const seen = new Set<string>();
      let cursor: string | null | undefined = entity.id;
      while (cursor) {
        if (seen.has(cursor)) throw new ApiError(422, "Knowledge hierarchy cannot contain a cycle.");
        seen.add(cursor);
        cursor = parents.get(cursor);
      }
    }
    if (!input.entities.some((item) => item.selected)) throw new ApiError(422, "Select at least one knowledge entity.");
    const segments = new Map((await prisma.sourceSegment.findMany({ where: { courseId }, select: { id: true, materialId: true, normalizedText: true } })).map((item) => [item.id, item]));
    for (const entity of input.entities) for (const evidence of entity.evidence) {
      const segment = segments.get(evidence.segmentId);
      if (!segment || segment.materialId !== evidence.materialId || !segment.normalizedText.includes(evidence.quote)) throw new ApiError(422, "Entity evidence must refer to an exact quote in this course.");
    }
    await prisma.$transaction(async (tx) => {
      const locked = await tx.course.updateMany({ where: { id: courseId, entityRevision: input.revision, status: "AWAITING_ENTITY_REVIEW" }, data: { entityRevision: { increment: 1 } } });
      if (!locked.count) throw new ApiError(409, "Knowledge changed in another session. Refresh before saving.");
      await tx.knowledgeEntity.deleteMany({ where: { courseId } });
      for (const item of input.entities) await tx.knowledgeEntity.create({ data: { id: item.id, courseId, name: item.name, description: item.description, aliases: item.aliases as Prisma.InputJsonValue, importance: item.importance, selected: item.selected, evidence: item.evidence as Prisma.InputJsonValue } });
      for (const item of input.entities.filter((entity) => entity.parentId)) await tx.knowledgeEntity.update({ where: { id: item.id }, data: { parentId: item.parentId } });
    });
    return Response.json({ revision: course.entityRevision + 1 });
  } catch (error) { return apiError(error); }
}
