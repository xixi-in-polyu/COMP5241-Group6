import { head } from "@vercel/blob";
import { start } from "workflow/api";
import { z } from "zod";
import { ApiError, apiError, ownedCourse, requireTeacherApi } from "@/lib/api";
import { startUsageRun } from "@/lib/assignments/usage";
import { validateMaterialMetadata } from "@/lib/materials/parsers";
import { prisma } from "@/lib/prisma";
import { ingestionWorkflow } from "@/workflows/assignment";

const itemSchema = z.object({ name: z.string().min(1), mimeType: z.string().min(1), size: z.number().int().positive(), blobPathname: z.string().min(1) });
const inputSchema = z.object({ materials: z.array(itemSchema).min(1).max(2) });

export async function POST(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const teacher = await requireTeacherApi();
    const { courseId } = await params;
    const course = await ownedCourse(courseId, teacher.id);
    if (course.status === "READY") throw new ApiError(409, "Course materials are locked after knowledge confirmation.");
    const input = inputSchema.parse(await request.json());
    const existing = await prisma.courseMaterial.findMany({ where: { courseId } });
    if (existing.length + input.materials.length > 2) throw new ApiError(422, "A course can contain at most two documents.");
    const verified = [];
    for (const item of input.materials) {
      if (!item.blobPathname.startsWith(`learning-platform/courses/${courseId}/`)) throw new ApiError(422, "Invalid Blob path.");
      const blob = await head(item.blobPathname);
      validateMaterialMetadata(item.name, blob.contentType || item.mimeType, blob.size);
      verified.push({ ...item, mimeType: blob.contentType || item.mimeType, size: blob.size, blobPathname: blob.pathname });
    }
    const total = existing.reduce((sum, item) => sum + item.size, 0) + verified.reduce((sum, item) => sum + item.size, 0);
    if (total > 20 * 1024 * 1024) throw new ApiError(422, "Course documents must total no more than 20 MiB.");
    await prisma.courseMaterial.createMany({ data: verified.map((item) => ({ ...item, courseId })) });
    const run = await startUsageRun(courseId, teacher.id, "ingestion");
    const workflow = await start(ingestionWorkflow, [courseId, run.id]);
    return Response.json({ runId: workflow.runId, status: "INGESTING" }, { status: 202 });
  } catch (error) { return apiError(error); }
}
