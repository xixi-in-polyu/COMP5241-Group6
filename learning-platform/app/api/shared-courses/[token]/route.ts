import { ApiError, apiError } from "@/lib/api";
import { requireCourseUser } from "@/lib/courses/auth";
import { hashShareToken } from "@/lib/courses/security";
import { COURSE_INCLUDE, serializeCourse } from "@/lib/courses/serialize";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    await requireCourseUser();
    const { token } = await params;
    const course = await prisma.course.findFirst({
      where: {
        shareTokenHash: hashShareToken(token),
        publicationStatus: "PUBLISHED",
        archivedAt: null,
      },
      include: COURSE_INCLUDE,
    });
    if (!course) throw new ApiError(404, "Shared course not found.");
    return Response.json({ course: serializeCourse(course) });
  } catch (error) {
    return apiError(error);
  }
}
