import { ApiError, apiError, ownedAssignment, requireTeacherApi } from "@/lib/api";
import { failedSlotsSchema, questionsSchema } from "@/lib/assignments/domain";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const teacher = await requireTeacherApi();
    const { assignmentId } = await params;
    const assignment = await ownedAssignment(assignmentId, teacher.id);
    if (assignment.status !== "DRAFT") throw new ApiError(409, "Only draft assignments can be submitted.");
    const body = await request.json().catch(() => ({})) as { version?: number };
    if (body.version !== assignment.version) throw new ApiError(409, "Save and refresh the latest draft before submitting.");
    if (failedSlotsSchema.parse(assignment.failedSlots).length) throw new ApiError(422, "Resolve every failed slot before submitting.");
    if (!questionsSchema.parse(assignment.questions).length) throw new ApiError(422, "An assignment must contain at least one valid question.");
    const result = await prisma.assignment.updateMany({ where: { id: assignmentId, version: assignment.version, status: "DRAFT" }, data: { status: "SUBMITTED", submittedAt: new Date(), version: { increment: 1 } } });
    if (!result.count) throw new ApiError(409, "Draft changed in another session.");
    return Response.json({ status: "SUBMITTED", version: assignment.version + 1 });
  } catch (error) { return apiError(error); }
}
