import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError, apiError, ownedAssignment, requireTeacherApi } from "@/lib/api";
import { loadAssignmentKnowledgeContext } from "@/lib/assignments/context";
import { questionSchema, questionsSchema } from "@/lib/assignments/domain";
import { prisma } from "@/lib/prisma";

const schema = z.object({ version: z.number().int().nonnegative(), question: questionSchema });
export async function POST(request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const teacher = await requireTeacherApi();
    const { assignmentId } = await params;
    const assignment = await ownedAssignment(assignmentId, teacher.id);
    if (assignment.status !== "DRAFT") throw new ApiError(409, "Submitted assignments are locked.");
    const input = schema.parse(await request.json());
    if (input.version !== assignment.version) throw new ApiError(409, "Draft changed in another session.");
    const question = questionSchema.parse({ ...input.question, origin: "teacher_authored" });
    const validEntityIds = new Set((await loadAssignmentKnowledgeContext(assignmentId)).entities.map((item) => item.id));
    if (question.entityIds.some((id) => !validEntityIds.has(id))) throw new ApiError(422, "Question references knowledge outside this course.");
    const changed = await prisma.assignment.updateMany({ where: { id: assignmentId, version: input.version, status: "DRAFT" }, data: { questions: [...questionsSchema.parse(assignment.questions), question] as Prisma.InputJsonValue, version: { increment: 1 } } });
    if (!changed.count) throw new ApiError(409, "Draft changed in another session.");
    return Response.json({ version: assignment.version + 1, question });
  } catch (error) { return apiError(error); }
}
