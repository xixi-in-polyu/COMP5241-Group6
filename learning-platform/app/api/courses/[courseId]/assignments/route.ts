import { Prisma } from "@prisma/client";
import { head } from "@vercel/blob";
import { start } from "workflow/api";
import { z } from "zod";
import { ApiError, apiError, ownedCourse, requireTeacherApi } from "@/lib/api";
import { validateAssignmentSourceSelection } from "@/lib/assignments/staged";
import { startUsageRun } from "@/lib/assignments/usage";
import { validateMaterialMetadata } from "@/lib/materials/parsers";
import { validateTranscriptMetadata } from "@/lib/materials/subtitles";
import { prisma } from "@/lib/prisma";
import { assignmentIngestionWorkflow } from "@/workflows/assignment";

const fileSourceSchema = z.object({
  kind: z.enum(["FILE", "TRANSCRIPT"]),
  name: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1),
  size: z.number().int().positive().max(20 * 1024 * 1024),
  blobPathname: z.string().trim().min(1),
});
const createSchema = z.object({
  assignmentId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(160),
  sources: z
    .array(fileSourceSchema)
    .max(2)
    .default([]),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
    const teacher = await requireTeacherApi();
    const { courseId } = await params;
    await ownedCourse(courseId, teacher.id);
    return Response.json({
      assignments: await prisma.assignment.findMany({
        where: { courseId },
        orderBy: { updatedAt: "desc" },
      }),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
    const teacher = await requireTeacherApi();
    const { courseId } = await params;
    const course = await ownedCourse(courseId, teacher.id);
    if (course.status !== "READY") {
      throw new ApiError(409, "Finish the course setup before creating assignments.");
    }
    const input = createSchema.parse(await request.json());
    validateAssignmentSourceSelection(
      input.sources.map((source) => ({
        kind: source.kind,
        status: "UPLOADED" as const,
        size: "size" in source ? source.size : undefined,
      })),
    );
    const hasCourseKnowledge = Boolean(
      await prisma.knowledgeEntity.count({
        where: { courseId, selected: true },
      }),
    );
    if (!hasCourseKnowledge && !input.sources.length) {
      throw new ApiError(
        422,
        "Add a source because this course has no reusable knowledge.",
      );
    }
    const verifiedSources = [];
    for (const source of input.sources) {
      const expectedPrefix = input.assignmentId
        ? `learning-platform/courses/${courseId}/assignments/${input.assignmentId}/`
        : "";
      if (!expectedPrefix || !source.blobPathname.startsWith(expectedPrefix)) {
        throw new ApiError(422, "Invalid assignment Blob path.");
      }
      const blob = await head(source.blobPathname);
      const verified = {
        ...source,
        blobPathname: blob.pathname,
        mimeType: blob.contentType || source.mimeType,
        size: blob.size,
      };
      if (source.kind === "TRANSCRIPT") {
        validateTranscriptMetadata(verified.name, verified.mimeType, verified.size);
      } else {
        validateMaterialMetadata(verified.name, verified.mimeType, verified.size);
      }
      verifiedSources.push(verified);
    }

    let assignment;
    try {
      assignment = await prisma.assignment.create({
        data: {
          id: input.assignmentId,
          courseId,
          title: input.title,
          status: "INGESTING",
          phase: "Processing assignment sources",
          materials: {
            create: verifiedSources.map((source) => ({
              name: source.name,
              kind: source.kind,
              mimeType: source.mimeType,
              size: source.size,
              blobPathname: source.blobPathname,
            })),
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ApiError(
          409,
          "This course already has an active assignment workflow.",
        );
      }
      throw error;
    }
    const run = await startUsageRun(
      courseId,
      teacher.id,
      "assignment_ingestion",
      assignment.id,
    );
    await prisma.assignment.update({
      where: { id: assignment.id },
      data: { ingestionRunId: run.id },
    });
    const workflow = await start(assignmentIngestionWorkflow, [
      assignment.id,
      run.id,
    ]);
    return Response.json(
      { assignmentId: assignment.id, runId: workflow.runId },
      { status: 202 },
    );
  } catch (error) {
    return apiError(error);
  }
}
