import { apiError, ownedCourse, requireTeacherApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const teacher = await requireTeacherApi();
    const { courseId } = await params;
    await ownedCourse(courseId, teacher.id);
    const events = await prisma.usageEvent.findMany({ where: { courseId }, orderBy: { createdAt: "desc" }, take: 200 });
    return Response.json({ events });
  } catch (error) { return apiError(error); }
}
