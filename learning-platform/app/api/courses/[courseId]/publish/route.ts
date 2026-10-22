import { ApiError, apiError } from "@/lib/api";
import { assertCourseWritesEnabled, requireCourseUser, requireOwnedCourse } from "@/lib/courses/auth";
import { createShareToken } from "@/lib/courses/security";
import { prisma } from "@/lib/prisma";

function blockHasContent(block: { type: string; payload: unknown }) {
  const payload = block.payload && typeof block.payload === "object" && !Array.isArray(block.payload)
    ? block.payload as Record<string, unknown>
    : {};
  if (["HEADING", "TEXT", "SUMMARY"].includes(block.type)) return String(payload.text ?? "").trim().length > 0;
  if (block.type === "ACTIVITY") {
    const items = Array.isArray(payload.items) ? payload.items : [];
    return String(payload.instruction ?? "").trim().length > 0 || items.length > 0;
  }
  return false;
}

export async function POST(_request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    assertCourseWritesEnabled();
    const user = await requireCourseUser();
    const { courseId } = await params;
    const owned = await requireOwnedCourse(courseId, user.id);
    if (owned.archivedAt) throw new ApiError(409, "Restore the course before publishing it.");
    const course = await prisma.course.findUniqueOrThrow({
      where: { id: courseId },
      include: { chapters: { include: { blocks: true } }, materials: true },
    });
    if (!course.title.trim()) throw new ApiError(422, "A title is required before publishing.");
    if (!course.chapters.length || !course.chapters.some((chapter) => chapter.blocks.some(blockHasContent))) {
      throw new ApiError(422, "Add at least one chapter with content before publishing.");
    }
    if (course.materials.some((material) => !["READY", "DOWNLOAD_ONLY"].includes(material.status))) {
      throw new ApiError(422, "Wait for materials to finish processing or remove failed uploads.");
    }
    const share = createShareToken();
    await prisma.course.update({
      where: { id: courseId },
      data: { publicationStatus: "PUBLISHED", shareTokenHash: share.hash },
    });
    return Response.json({ shareUrl: `/courses/share/${share.token}` });
  } catch (error) {
    return apiError(error);
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
      data: { publicationStatus: "DRAFT", shareTokenHash: null },
    });
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
