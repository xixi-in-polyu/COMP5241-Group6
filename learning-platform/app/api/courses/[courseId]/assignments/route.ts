import { Prisma } from "@prisma/client";
import { start } from "workflow/api";
import { ApiError, apiError, ownedCourse, requireTeacherApi } from "@/lib/api";
import { isAiConfigured } from "@/lib/assignments/ai";
import { briefSchema } from "@/lib/assignments/domain";
import { checkAiLimit, startUsageRun } from "@/lib/assignments/usage";
import { prisma } from "@/lib/prisma";
import { generationWorkflow } from "@/workflows/assignment";

export async function GET(_request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const teacher = await requireTeacherApi();
    const { courseId } = await params;
    await ownedCourse(courseId, teacher.id);
    return Response.json({ assignments: await prisma.assignment.findMany({ where: { courseId }, orderBy: { updatedAt: "desc" } }) });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const teacher = await requireTeacherApi();
    const { courseId } = await params;
    const course = await ownedCourse(courseId, teacher.id);
    if (!isAiConfigured()) return Response.json({ error: "AI provider is not configured." }, { status: 503 });
    if (course.status !== "READY") throw new ApiError(409, "Confirm course knowledge before generating an assignment.");
    if (await prisma.assignment.count({ where: { courseId, status: "GENERATING" } })) throw new ApiError(409, "This course already has an assignment generation in progress.");
    const brief = briefSchema.parse(await request.json());
    const limit = await checkAiLimit(teacher.id, courseId);
    if (!limit.allowed) return Response.json({ error: "AI usage limit reached." }, { status: 429, headers: { "retry-after": String(limit.retryAfter) } });
    let assignment;
    try { assignment = await prisma.assignment.create({ data: { courseId, title: brief.title, originalBrief: brief as Prisma.InputJsonValue } }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ApiError(409, "This course already has an assignment generation in progress."); throw error; }
    const run = await startUsageRun(courseId, teacher.id, "generation", assignment.id);
    const workflow = await start(generationWorkflow, [assignment.id, run.id]);
    return Response.json({ assignmentId: assignment.id, runId: workflow.runId }, { status: 202 });
  } catch (error) { return apiError(error); }
}
