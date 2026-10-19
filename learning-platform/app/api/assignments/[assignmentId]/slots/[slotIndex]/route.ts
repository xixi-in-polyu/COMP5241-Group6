import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError, apiError, ownedAssignment, requireTeacherApi } from "@/lib/api";
import { loadAssignmentKnowledgeContext } from "@/lib/assignments/context";
import { failedSlotsSchema, questionSchema, questionsSchema } from "@/lib/assignments/domain";
import { prisma } from "@/lib/prisma";

const manualSchema = z.object({ version: z.number().int().nonnegative(), question: questionSchema });

export async function DELETE(request: Request, { params }: { params: Promise<{ assignmentId: string; slotIndex: string }> }) {
  try {
    const teacher = await requireTeacherApi();
    const { assignmentId, slotIndex } = await params;
    const assignment = await ownedAssignment(assignmentId, teacher.id);
    if (assignment.status !== "DRAFT") throw new ApiError(409, "Submitted assignments are locked.");
    const index = z.coerce.number().int().nonnegative().parse(slotIndex);
    const body = await request.json() as { version?: number };
    if (body.version !== assignment.version) throw new ApiError(409, "Draft changed in another session.");
    const failures = failedSlotsSchema.parse(assignment.failedSlots);
    if (!failures.some((item) => item.index === index)) throw new ApiError(404, "Failed slot not found.");
    const changed = await prisma.assignment.updateMany({ where: { id: assignmentId, version: body.version, status: "DRAFT" }, data: { failedSlots: failures.filter((item) => item.index !== index) as Prisma.InputJsonValue, version: { increment: 1 } } });
    if (!changed.count) throw new ApiError(409, "Draft changed in another session.");
    return Response.json({ version: assignment.version + 1 });
  } catch (error) { return apiError(error); }
}

export async function PUT(request: Request, { params }: { params: Promise<{ assignmentId: string; slotIndex: string }> }) {
  try {
    const teacher = await requireTeacherApi();
    const { assignmentId, slotIndex } = await params;
    const assignment = await ownedAssignment(assignmentId, teacher.id);
    if (assignment.status !== "DRAFT") throw new ApiError(409, "Submitted assignments are locked.");
    const index = z.coerce.number().int().nonnegative().parse(slotIndex);
    const input = manualSchema.parse(await request.json());
    if (input.version !== assignment.version) throw new ApiError(409, "Draft changed in another session.");
    const failures = failedSlotsSchema.parse(assignment.failedSlots);
    if (!failures.some((item) => item.index === index)) throw new ApiError(404, "Failed slot not found.");
    const question = questionSchema.parse({ ...input.question, origin: "teacher_authored" });
    const validEntityIds = new Set((await loadAssignmentKnowledgeContext(assignmentId)).entities.map((item) => item.id));
    if (question.entityIds.some((id) => !validEntityIds.has(id))) throw new ApiError(422, "Question references knowledge outside this course.");
    const questions = questionsSchema.parse(assignment.questions);
    const changed = await prisma.assignment.updateMany({ where: { id: assignmentId, version: input.version, status: "DRAFT" }, data: { questions: [...questions, question] as Prisma.InputJsonValue, failedSlots: failures.filter((item) => item.index !== index) as Prisma.InputJsonValue, version: { increment: 1 } } });
    if (!changed.count) throw new ApiError(409, "Draft changed in another session.");
    return Response.json({ version: assignment.version + 1, question });
  } catch (error) { return apiError(error); }
}
