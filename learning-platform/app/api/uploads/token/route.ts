import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";
import { ApiError, apiError } from "@/lib/api";
import { assertCourseWritesEnabled, requireCourseUser, requireOwnedCourse } from "@/lib/courses/auth";
import { prisma } from "@/lib/prisma";

const payloadSchema = z.object({
  courseId: z.string().uuid(),
  assignmentId: z.string().uuid().optional(),
  contentType: z.string().min(1),
  size: z.number().int().positive().max(20 * 1024 * 1024),
});
const allowed = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/x-subrip",
  "text/plain",
  "text/vtt",
];

export async function POST(request: Request) {
  try {
    assertCourseWritesEnabled();
    if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ error: "Private Blob is not configured." }, { status: 503 });
    const user = await requireCourseUser();
    const body = await request.json() as HandleUploadBody;
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, raw) => {
        const input = payloadSchema.parse(JSON.parse(raw || "{}"));
        await requireOwnedCourse(input.courseId, user.id);
        if (input.assignmentId) {
          if (user.role !== "teacher") throw new ApiError(403, "Teacher access required.");
          const assignment = await prisma.assignment.findUnique({
            where: { id: input.assignmentId },
            select: { courseId: true },
          });
          if (assignment && assignment.courseId !== input.courseId) {
            throw new ApiError(422, "Assignment does not belong to this course.");
          }
        }
        const prefix = input.assignmentId
          ? `learning-platform/courses/${input.courseId}/assignments/${input.assignmentId}/`
          : `learning-platform/courses/${input.courseId}/`;
        if (!pathname.startsWith(prefix)) throw new Error("Invalid upload path.");
        if (!allowed.includes(input.contentType)) throw new Error("Unsupported file type.");
        return { allowedContentTypes: allowed, maximumSizeInBytes: 20 * 1024 * 1024, addRandomSuffix: true };
      },
      onUploadCompleted: async () => {},
    });
    return Response.json(response);
  } catch (error) { return apiError(error); }
}
