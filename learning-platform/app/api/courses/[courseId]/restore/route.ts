import { apiError } from "@/lib/api";
import { assertCourseWritesEnabled, requireCourseUser, requireOwnedCourse } from "@/lib/courses/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    assertCourseWritesEnabled();
    const user = await requireCourseUser();
    const { courseId } = await params;
    await requireOwnedCourse(courseId, user.id);
    await prisma.course.update({
      where: { id: courseId },
      data: { archivedAt: null, publicationStatus: "DRAFT", shareTokenHash: null },
    });
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
