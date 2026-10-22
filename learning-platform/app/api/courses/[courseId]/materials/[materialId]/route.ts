import { del, head } from "@vercel/blob";
import { start } from "workflow/api";
import { z } from "zod";

import { ApiError, apiError } from "@/lib/api";
import { assertCourseWritesEnabled, requireCourseUser, requireOwnedCourse } from "@/lib/courses/auth";
import { prisma } from "@/lib/prisma";
import { validateMaterialMetadata } from "@/lib/materials/parsers";
import { courseMaterialParsingWorkflow } from "@/workflows/course-material";

const replacementSchema = z.object({
  name: z.string().trim().min(1).max(255),
  mimeType: z.string().min(1),
  size: z.number().int().positive(),
  blobPathname: z.string().min(1),
});

export async function DELETE(_request: Request, { params }: { params: Promise<{ courseId: string; materialId: string }> }) {
  try {
    assertCourseWritesEnabled();
    const user = await requireCourseUser();
    const { courseId, materialId } = await params;
    await requireOwnedCourse(courseId, user.id);
    const material = await prisma.courseMaterial.findFirst({ where: { id: materialId, courseId } });
    if (!material) throw new ApiError(404, "Material not found.");
    await prisma.$transaction([
      prisma.sourceSegment.deleteMany({ where: { materialId } }),
      prisma.courseMaterial.delete({ where: { id: materialId } }),
      prisma.course.update({
        where: { id: courseId },
        data: {
          publicationStatus: "DRAFT",
          shareTokenHash: null,
          knowledgeStale: user.role === "teacher",
          aiSelectionConfirmed: false,
        },
      }),
    ]);
    if (material.blobPathname) await del(material.blobPathname).catch(() => undefined);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(_request: Request, { params }: { params: Promise<{ courseId: string; materialId: string }> }) {
  try {
    assertCourseWritesEnabled();
    const user = await requireCourseUser();
    const { courseId, materialId } = await params;
    await requireOwnedCourse(courseId, user.id);
    const material = await prisma.courseMaterial.findFirst({ where: { id: materialId, courseId, kind: "FILE" } });
    if (!material) throw new ApiError(404, "Material not found.");
    await prisma.courseMaterial.update({ where: { id: materialId }, data: { status: "UPLOADED", errorCode: null, errorDetail: null } });
    const workflow = await start(courseMaterialParsingWorkflow, [materialId]);
    return Response.json({ runId: workflow.runId }, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ courseId: string; materialId: string }> }) {
  let newPath = "";
  let persisted = false;
  try {
    assertCourseWritesEnabled();
    const user = await requireCourseUser();
    const { courseId, materialId } = await params;
    await requireOwnedCourse(courseId, user.id);
    const input = replacementSchema.parse(await request.json());
    if (!input.blobPathname.startsWith(`learning-platform/courses/${courseId}/`)) throw new ApiError(422, "Invalid Blob path.");
    const current = await prisma.courseMaterial.findFirst({ where: { id: materialId, courseId, kind: "FILE" } });
    if (!current) throw new ApiError(404, "Material not found.");
    const blob = await head(input.blobPathname);
    newPath = blob.pathname;
    validateMaterialMetadata(input.name, blob.contentType || input.mimeType, blob.size);
    const otherBytes = await prisma.courseMaterial.aggregate({ where: { courseId, kind: "FILE", id: { not: materialId } }, _sum: { size: true } });
    if ((otherBytes._sum.size ?? 0) + blob.size > 100 * 1024 * 1024) throw new ApiError(422, "Course files must total no more than 100 MiB.");
    await prisma.$transaction([
      prisma.sourceSegment.deleteMany({ where: { materialId } }),
      prisma.courseMaterial.update({ where: { id: materialId }, data: { name: input.name, mimeType: blob.contentType || input.mimeType, size: blob.size, blobPathname: blob.pathname, status: "UPLOADED", pageCount: null, errorCode: null, errorDetail: null } }),
      prisma.course.update({ where: { id: courseId }, data: { publicationStatus: "DRAFT", shareTokenHash: null, knowledgeStale: user.role === "teacher", aiSelectionConfirmed: false } }),
    ]);
    persisted = true;
    if (current.blobPathname && current.blobPathname !== blob.pathname) await del(current.blobPathname).catch(() => undefined);
    const workflow = await start(courseMaterialParsingWorkflow, [materialId]);
    return Response.json({ runId: workflow.runId }, { status: 202 });
  } catch (error) {
    if (newPath && !persisted) await del(newPath).catch(() => undefined);
    return apiError(error);
  }
}

export const PUT = PATCH;
