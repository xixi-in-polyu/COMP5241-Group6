import { entitySchema } from "@/lib/assignments/domain";
import { serializeAssignment } from "@/lib/assignments/serialize";
import { apiError } from "@/lib/api";
import { assertCourseWritesEnabled, requireCourseUser, requireOwnedCourse } from "@/lib/courses/auth";
import { COURSE_CONTENT_TRANSACTION_OPTIONS, replaceCourseContent } from "@/lib/courses/content";
import { getOwnedCourse } from "@/lib/courses/queries";
import { COURSE_INCLUDE, serializeCourse } from "@/lib/courses/serialize";
import { courseCreateSchema, coursePatchSchema } from "@/lib/courses/validation";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const user = await requireCourseUser();
    const { courseId } = await params;
    await requireOwnedCourse(courseId, user.id);
    const row = await prisma.course.findUniqueOrThrow({
      where: { id: courseId },
      include: {
        ...COURSE_INCLUDE,
        entities: { orderBy: [{ importance: "asc" }, { name: "asc" }] },
        assignments: { orderBy: { updatedAt: "desc" } },
      },
    });
    const course = serializeCourse(row);
    return Response.json({
      course: {
        ...course,
        pastedNotes: row.materials.find((item) => item.kind === "TEXT" && item.chapterId === null)?.textContent ?? "",
        status: row.status,
        phase: row.phase,
        error: row.error,
        entityRevision: row.entityRevision,
        entities: row.entities.map((item) => entitySchema.parse({ ...item, aliases: item.aliases, evidence: item.evidence })),
        assignments: row.assignments.map(serializeAssignment),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    assertCourseWritesEnabled();
    const user = await requireCourseUser();
    const { courseId } = await params;
    await requireOwnedCourse(courseId, user.id);
    const current = await getOwnedCourse(user.id, courseId);
    const raw = await request.json() as Record<string, unknown>;
    const patch = coursePatchSchema.parse(raw);
    const explicitPatch = Object.fromEntries(
      Object.keys(raw).flatMap((key) => key in patch ? [[key, patch[key as keyof typeof patch]]] : []),
    );
    const input = courseCreateSchema.parse({ ...current, ...explicitPatch });
    await prisma.$transaction(
      (tx) => replaceCourseContent(tx, courseId, input),
      COURSE_CONTENT_TRANSACTION_OPTIONS,
    );
    return Response.json({ course: await getOwnedCourse(user.id, courseId) });
  } catch (error) {
    const response = apiError(error);
    if (response.status === 503) response.headers.set("Retry-After", "300");
    return response;
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    assertCourseWritesEnabled();
    const user = await requireCourseUser();
    const { courseId } = await params;
    await requireOwnedCourse(courseId, user.id);
    await prisma.course.update({
      where: { id: courseId },
      data: { archivedAt: new Date(), publicationStatus: "DRAFT", shareTokenHash: null },
    });
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
