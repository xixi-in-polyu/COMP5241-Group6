import { ApiError, apiError } from "@/lib/api";
import { requireCourseUser } from "@/lib/courses/auth";
import { materialDownloadResponse } from "@/lib/courses/download";
import { hashShareToken } from "@/lib/courses/security";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string; materialId: string }> }) {
  try {
    await requireCourseUser();
    const { token, materialId } = await params;
    const course = await prisma.course.findFirst({
      where: { shareTokenHash: hashShareToken(token), publicationStatus: "PUBLISHED", archivedAt: null },
      select: { id: true },
    });
    if (!course) throw new ApiError(404, "Shared course not found.");
    const material = await prisma.courseMaterial.findFirst({ where: { id: materialId, courseId: course.id } });
    if (!material || !["READY", "DOWNLOAD_ONLY"].includes(material.status)) {
      throw new ApiError(404, "Material not found.");
    }
    return materialDownloadResponse(material);
  } catch (error) {
    return apiError(error);
  }
}
