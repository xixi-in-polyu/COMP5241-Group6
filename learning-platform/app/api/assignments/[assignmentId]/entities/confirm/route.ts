import { z } from "zod";
import { HookNotFoundError } from "workflow/errors";
import { ApiError, apiError, ownedAssignment, requireTeacherApi } from "@/lib/api";
import { finishUsageRun } from "@/lib/assignments/usage";
import { prisma } from "@/lib/prisma";
import { assignmentEntityReviewHook } from "@/workflows/hooks";

const inputSchema = z.object({ revision: z.number().int().nonnegative() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  try {
    const teacher = await requireTeacherApi();
    const { assignmentId } = await params;
    const assignment = await ownedAssignment(assignmentId, teacher.id);
    const input = inputSchema.parse(await request.json());
    if (
      assignment.status !== "AWAITING_ENTITY_REVIEW" ||
      !assignment.workflowHookToken?.startsWith("assignment-entity-review:")
    ) {
      throw new ApiError(409, "Assignment knowledge is not waiting for confirmation.");
    }
    if (assignment.entityRevision !== input.revision) {
      throw new ApiError(409, "Knowledge changed in another session.");
    }
    if (
      !(await prisma.assignmentKnowledgeEntity.count({
        where: { assignmentId, selected: true },
      }))
    ) {
      throw new ApiError(422, "Select at least one knowledge entity.");
    }
    try {
      await assignmentEntityReviewHook.resume(assignment.workflowHookToken, {
        revision: input.revision,
      });
      return Response.json({ status: "PROCESSING" }, { status: 202 });
    } catch (error) {
      if (!HookNotFoundError.is(error)) throw error;

      const recovered = await prisma.assignment.updateMany({
        where: {
          id: assignmentId,
          status: "AWAITING_ENTITY_REVIEW",
          entityRevision: input.revision,
          workflowHookToken: assignment.workflowHookToken,
        },
        data: {
          status: "READY_TO_GENERATE",
          phase: "Ready to define the assignment brief",
          workflowHookToken: null,
          error: null,
        },
      });
      if (!recovered.count) {
        throw new ApiError(409, "Assignment state changed while recovering confirmation.");
      }
      if (assignment.ingestionRunId) {
        await finishUsageRun(assignment.ingestionRunId, "SUCCESS").catch(
          (usageError) => {
            console.error(
              "[assignment-knowledge] could not finish recovered usage run",
              {
                assignmentId,
                usageRunId: assignment.ingestionRunId,
                error:
                  usageError instanceof Error
                    ? usageError.message
                    : String(usageError),
              },
            );
          },
        );
      }
      console.warn("[assignment-knowledge] recovered missing workflow hook", {
        assignmentId,
        workflowHookToken: assignment.workflowHookToken,
      });
      return Response.json(
        { status: "READY_TO_GENERATE", recovered: true },
        { status: 202 },
      );
    }
  } catch (error) {
    return apiError(error);
  }
}
