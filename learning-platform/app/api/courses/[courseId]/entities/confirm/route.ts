import { z } from "zod";
import { ApiError, apiError, ownedCourse, requireTeacherApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const inputSchema = z.object({ revision: z.number().int().nonnegative() });

export async function POST(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const teacher = await requireTeacherApi();
    const { courseId } = await params;
    const course = await ownedCourse(courseId, teacher.id);
    const input = inputSchema.parse(await request.json());
    if (course.status !== "AWAITING_ENTITY_REVIEW") throw new ApiError(409, "Knowledge cannot be confirmed in the current state.");
    if (course.entityRevision !== input.revision) throw new ApiError(409, "Knowledge changed in another session. Refresh before confirming.");
    if (!await prisma.knowledgeEntity.count({ where: { courseId, selected: true } })) throw new ApiError(422, "Select at least one knowledge entity.");
    const updated = await prisma.course.updateMany({ where: { id: courseId, entityRevision: input.revision, status: "AWAITING_ENTITY_REVIEW" }, data: { status: "READY", phase: "Ready to create assignments", error: null } });
    if (!updated.count) throw new ApiError(409, "Knowledge changed in another session. Refresh before confirming.");
    return Response.json({ status: "READY" });
  } catch (error) { return apiError(error); }
}
