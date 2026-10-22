import "server-only";

import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function loadCourseAiSources(courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      materials: {
        orderBy: { createdAt: "asc" },
        include: { segments: { orderBy: { ordinal: "asc" } } },
      },
    },
  });
  if (!course) throw new ApiError(404, "Course not found.");
  const notes = course.materials.filter((item) => item.kind === "TEXT" && item.chapterId === null && item.textContent);
  const readyFiles = course.materials.filter((item) => item.kind === "FILE" && item.status === "READY");
  if (readyFiles.length > 8 && !course.aiSelectionConfirmed) {
    throw new ApiError(409, "Select up to 8 AI source files before generating course content.");
  }
  const files = readyFiles.length <= 8 ? readyFiles : readyFiles.filter((item) => item.aiSelected).slice(0, 8);
  if (readyFiles.length > 8 && files.length === 0) {
    throw new ApiError(409, "Select at least one AI source file before generating course content.");
  }
  return [
    ...notes.slice(0, 1).map((item) => ({ label: item.name, text: item.textContent ?? "" })),
    ...files.map((item) => ({
      label: item.name,
      text: item.segments.map((segment) => segment.normalizedText).join("\n\n"),
    })),
  ];
}
