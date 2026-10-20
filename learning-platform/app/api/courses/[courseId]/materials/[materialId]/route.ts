import { del, head } from "@vercel/blob";
import { start } from "workflow/api";
import { z } from "zod";
import { ApiError, apiError, ownedCourse, requireTeacherApi } from "@/lib/api";
import { validateMaterialMetadata } from "@/lib/materials/parsers";
import { startUsageRun } from "@/lib/assignments/usage";
import { prisma } from "@/lib/prisma";
import { ingestionWorkflow } from "@/workflows/assignment";

const replaceSchema = z.object({ name: z.string().min(1), mimeType: z.string().min(1), size: z.number().int().positive(), blobPathname: z.string().min(1) });

export async function PUT(request: Request, { params }: { params: Promise<{ courseId: string; materialId: string }> }) {
  try {
    const teacher = await requireTeacherApi();
    const { courseId, materialId } = await params;
    const course = await ownedCourse(courseId, teacher.id);
    if (course.status !== "AWAITING_MATERIAL_FIX") throw new ApiError(409, "Materials are locked in the current state.");
    const before = await prisma.courseMaterial.findFirst({ where: { id: materialId, courseId } });
    if (!before) throw new ApiError(404, "Material not found.");
    const input = replaceSchema.parse(await request.json());
    if (!input.blobPathname.startsWith(`learning-platform/courses/${courseId}/`)) throw new ApiError(422, "Invalid Blob path.");
    const blob = await head(input.blobPathname);
    validateMaterialMetadata(input.name, blob.contentType || input.mimeType, blob.size);
    const others = await prisma.courseMaterial.aggregate({ where: { courseId, id: { not: materialId } }, _sum: { size: true } });
    if ((others._sum.size || 0) + blob.size > 20 * 1024 * 1024) throw new ApiError(422, "Course documents must total no more than 20 MiB.");
    await prisma.courseMaterial.update({ where: { id: materialId }, data: { name: input.name, mimeType: blob.contentType || input.mimeType, size: blob.size, blobPathname: blob.pathname, status: "UPLOADED", errorCode: null, errorDetail: null } });
    if (before.blobPathname !== blob.pathname) await del(before.blobPathname).catch(() => undefined);
    return Response.json({ materialId });
  } catch (error) { return apiError(error); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ courseId: string; materialId: string }> }) {
  try {
    const teacher = await requireTeacherApi();
    const { courseId, materialId } = await params;
    const course = await ownedCourse(courseId, teacher.id);
    if (course.status !== "AWAITING_MATERIAL_FIX") throw new ApiError(409, "Materials are locked in the current state.");
    if (await prisma.courseMaterial.count({ where: { courseId } }) <= 1) throw new ApiError(422, "A course must retain at least one material.");
    const material = await prisma.courseMaterial.findFirst({ where: { id: materialId, courseId } });
    if (!material) throw new ApiError(404, "Material not found.");
    await prisma.courseMaterial.delete({ where: { id: materialId } });
    await del(material.blobPathname).catch(() => undefined);
    await prisma.course.update({ where: { id: courseId }, data: { status: "INGESTING", phase: "Continuing with remaining materials" } });
    const run = await startUsageRun(courseId, teacher.id, "ingestion");
    const workflow = await start(ingestionWorkflow, [courseId, run.id]);
    return Response.json({ runId: workflow.runId }, { status: 202 });
  } catch (error) { return apiError(error); }
}
