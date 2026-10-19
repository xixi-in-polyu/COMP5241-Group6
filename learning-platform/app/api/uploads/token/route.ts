import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";
import { apiError, ownedCourse, requireTeacherApi } from "@/lib/api";

const payloadSchema = z.object({ courseId: z.string().uuid(), contentType: z.string().min(1), size: z.number().int().positive().max(20 * 1024 * 1024) });
const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "text/plain"];

export async function POST(request: Request) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ error: "Private Blob is not configured." }, { status: 503 });
    const teacher = await requireTeacherApi();
    const body = await request.json() as HandleUploadBody;
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, raw) => {
        const input = payloadSchema.parse(JSON.parse(raw || "{}"));
        await ownedCourse(input.courseId, teacher.id);
        if (!pathname.startsWith(`learning-platform/courses/${input.courseId}/`)) throw new Error("Invalid upload path.");
        if (!allowed.includes(input.contentType)) throw new Error("Unsupported file type.");
        return { allowedContentTypes: allowed, maximumSizeInBytes: 20 * 1024 * 1024, addRandomSuffix: true };
      },
      onUploadCompleted: async () => {},
    });
    return Response.json(response);
  } catch (error) { return apiError(error); }
}
