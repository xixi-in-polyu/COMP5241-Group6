import { del, head } from "@vercel/blob";
import { start } from "workflow/api";
import { z } from "zod";

import { ApiError, apiError } from "@/lib/api";
import { assertCourseWritesEnabled, requireCourseUser, requireOwnedCourse } from "@/lib/courses/auth";
import { validateMaterialMetadata } from "@/lib/materials/parsers";
import { prisma } from "@/lib/prisma";
import { courseMaterialParsingWorkflow } from "@/workflows/course-material";

const fileSchema = z.object({
  name: z.string().trim().min(1).max(255),
  mimeType: z.string().min(1),
  size: z.number().int().positive(),
  blobPathname: z.string().min(1),
  chapterId: z.string().uuid().nullable().optional(),
});
const inputSchema = z.object({ materials: z.array(fileSchema).min(1).max(20) });
const selectionSchema = z.object({ materialIds: z.array(z.string().uuid()).min(1).max(8) });
const TOTAL_BYTES = 100 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const uploadedPaths: string[] = [];
  let persisted = false;
  try {
    assertCourseWritesEnabled();
    const user = await requireCourseUser();
    const { courseId } = await params;
    await requireOwnedCourse(courseId, user.id);
    const input = inputSchema.parse(await request.json());
    const existing = await prisma.courseMaterial.findMany({ where: { courseId, kind: "FILE" } });
    if (existing.length + input.materials.length > 20) throw new ApiError(422, "A course can contain at most 20 uploaded files.");

    const verified: Array<z.infer<typeof fileSchema>> = [];
    for (const item of input.materials) {
      if (!item.blobPathname.startsWith(`learning-platform/courses/${courseId}/`)) {
        throw new ApiError(422, "Invalid Blob path.");
      }
      uploadedPaths.push(item.blobPathname);
      const blob = await head(item.blobPathname);
      validateMaterialMetadata(item.name, blob.contentType || item.mimeType, blob.size);
      if (item.chapterId) {
        const chapter = await prisma.courseChapter.findFirst({ where: { id: item.chapterId, courseId }, select: { id: true } });
        if (!chapter) throw new ApiError(422, "The selected chapter does not belong to this course.");
      }
      verified.push({ ...item, mimeType: blob.contentType || item.mimeType, size: blob.size, blobPathname: blob.pathname });
    }
    const total = existing.reduce((sum, item) => sum + item.size, 0) + verified.reduce((sum, item) => sum + item.size, 0);
    if (total > TOTAL_BYTES) throw new ApiError(422, "Course files must total no more than 100 MiB.");

    const created = await prisma.$transaction(async (tx) => {
      const rows = [];
      for (const item of verified) {
        rows.push(await tx.courseMaterial.create({
          data: {
            courseId,
            chapterId: item.chapterId ?? null,
            kind: "FILE",
            name: item.name,
            mimeType: item.mimeType,
            size: item.size,
            blobPathname: item.blobPathname,
            status: "UPLOADED",
            aiSelected: existing.filter((entry) => entry.status === "READY").length + rows.length < 8,
          },
          select: { id: true },
        }));
      }
      await tx.course.update({
        where: { id: courseId },
        data: {
          publicationStatus: "DRAFT",
          shareTokenHash: null,
          knowledgeStale: user.role === "teacher",
          aiSelectionConfirmed: false,
        },
      });
      return rows;
    });
    persisted = true;
    const workflows = await Promise.all(created.map((material) => start(courseMaterialParsingWorkflow, [material.id])));
    return Response.json({ materialIds: created.map((item) => item.id), runIds: workflows.map((item) => item.runId) }, { status: 202 });
  } catch (error) {
    if (!persisted) {
      await Promise.all(uploadedPaths.map((pathname) => del(pathname).catch(() => undefined)));
    }
    return apiError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    assertCourseWritesEnabled();
    const user = await requireCourseUser();
    const { courseId } = await params;
    await requireOwnedCourse(courseId, user.id);
    const input = selectionSchema.parse(await request.json());
    const ready = await prisma.courseMaterial.findMany({
      where: { courseId, kind: "FILE", status: "READY" },
      select: { id: true },
    });
    if (ready.length <= 8) throw new ApiError(409, "All ready files are already used automatically.");
    const readyIds = new Set(ready.map((item) => item.id));
    if (input.materialIds.some((id) => !readyIds.has(id))) throw new ApiError(422, "Only ready files from this course can be selected.");
    await prisma.$transaction([
      prisma.courseMaterial.updateMany({ where: { courseId, kind: "FILE" }, data: { aiSelected: false } }),
      prisma.courseMaterial.updateMany({ where: { id: { in: input.materialIds }, courseId }, data: { aiSelected: true } }),
      prisma.course.update({ where: { id: courseId }, data: { aiSelectionConfirmed: true } }),
    ]);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
