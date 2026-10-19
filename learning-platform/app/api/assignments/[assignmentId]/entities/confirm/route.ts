import { z } from "zod";
import { ApiError, apiError, ownedAssignment, requireTeacherApi } from "@/lib/api";
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
    await assignmentEntityReviewHook.resume(assignment.workflowHookToken, {
      revision: input.revision,
    });
    return Response.json({ status: "PROCESSING" }, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}
