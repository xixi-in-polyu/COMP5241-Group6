import { Prisma } from "@prisma/client";
import { start } from "workflow/api";

import {
  ApiError,
  apiError,
  ownedAssignment,
  requireTeacherApi,
} from "@/lib/api";
import { isAiConfigured } from "@/lib/assignments/ai";
import {
  checkAiLimit,
  finishUsageRun,
  startUsageRun,
} from "@/lib/assignments/usage";
import { prisma } from "@/lib/prisma";
import { assignmentIngestionWorkflow } from "@/workflows/assignment";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  let runId: string | undefined;
  try {
    const teacher = await requireTeacherApi();
    const { assignmentId } = await params;
    const assignment = await ownedAssignment(assignmentId, teacher.id);
    if (
      assignment.status !== "FAILED" ||
      assignment.phase !== "Assignment source workflow failed"
    ) {
      throw new ApiError(409, "Only failed source workflows can be retried.");
    }
    if (!isAiConfigured()) {
      return Response.json(
        { error: "AI provider is not configured." },
        { status: 503 },
      );
    }
    const limit = await checkAiLimit(teacher.id, assignment.courseId);
    if (!limit.allowed) {
      return Response.json(
        { error: "AI usage limit reached." },
        {
          status: 429,
          headers: { "retry-after": String(limit.retryAfter) },
        },
      );
    }
    const changed = await prisma.assignment.updateMany({
      where: {
        id: assignmentId,
        status: "FAILED",
        phase: "Assignment source workflow failed",
      },
      data: {
        status: "INGESTING",
        phase: "Retrying assignment source workflow",
        workflowHookToken: null,
        error: null,
      },
    });
    if (!changed.count) throw new ApiError(409, "Assignment state changed.");

    const run = await startUsageRun(
      assignment.courseId,
      teacher.id,
      "assignment_ingestion_retry",
      assignmentId,
    );
    runId = run.id;
    await prisma.assignment.update({
      where: { id: assignmentId },
      data: { ingestionRunId: run.id },
    });
    const workflow = await start(assignmentIngestionWorkflow, [
      assignmentId,
      run.id,
    ]);
    return Response.json({ runId: workflow.runId }, { status: 202 });
  } catch (error) {
    if (runId) {
      await finishUsageRun(
        runId,
        "FAILED",
        error instanceof Error ? error.message : "Could not restart workflow.",
      ).catch(() => undefined);
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return apiError(
        new ApiError(409, "This course already has an active assignment workflow."),
      );
    }
    return apiError(error);
  }
}
