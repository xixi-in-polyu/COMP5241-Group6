import { apiError } from "@/lib/api";
import { requireCourseUser, requireOwnedCourse } from "@/lib/courses/auth";
import { materialDownloadResponse } from "@/lib/courses/download";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ courseId: string; materialId: string }> }) {
  try {
    const user = await requireCourseUser();
    const { courseId, materialId } = await params;
    await requireOwnedCourse(courseId, user.id);
    const material = await prisma.courseMaterial.findFirstOrThrow({ where: { id: materialId, courseId } });
    return materialDownloadResponse(material);
  } catch (error) {
    return apiError(error);
  }
}
