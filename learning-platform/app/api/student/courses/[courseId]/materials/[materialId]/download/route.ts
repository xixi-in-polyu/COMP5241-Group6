import { ApiError, apiError } from "@/lib/api";
import { authorizeApiRole } from "@/lib/auth/authorization";
import { materialDownloadResponse } from "@/lib/courses/download";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: Promise<{ courseId: string; materialId: string }> }) {
  try {
    const authorization = await authorizeApiRole("student");
    if (authorization.response) return authorization.response;
    const { courseId, materialId } = await params;
    const course = await prisma.course.findFirst({
      where: { id: courseId, status: "READY", publicationStatus: "PUBLISHED", archivedAt: null },
      select: { id: true },
    });
    if (!course) throw new ApiError(404, "Course not found.");
    const material = await prisma.courseMaterial.findFirst({ where: { id: materialId, courseId, kind: "FILE" } });
    if (!material || !["READY", "DOWNLOAD_ONLY"].includes(material.status)) {
      throw new ApiError(404, "Material not found.");
    }
    const inline = new URL(request.url).searchParams.get("inline") === "1";
    return materialDownloadResponse(material, { disposition: inline ? "inline" : "attachment" });
  } catch (error) {
    return apiError(error);
  }
}
