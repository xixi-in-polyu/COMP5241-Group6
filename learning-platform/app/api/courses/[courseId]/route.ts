import { apiError, ownedCourse, requireTeacherApi } from "@/lib/api";
import { serializeCourse } from "@/lib/assignments/serialize";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const teacher = await requireTeacherApi();
    const { courseId } = await params;
    await ownedCourse(courseId, teacher.id);
    const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId }, include: { materials: { orderBy: { createdAt: "asc" } }, entities: { orderBy: [{ importance: "asc" }, { name: "asc" }] }, assignments: { orderBy: { updatedAt: "desc" } } } });
    return Response.json({ course: serializeCourse(course) });
  } catch (error) { return apiError(error); }
}
