import { z } from "zod";
import { ApiError, apiError, ownedCourse, requireTeacherApi } from "@/lib/api";
import { isAiConfigured, suggestBrief } from "@/lib/assignments/ai";
import { entitySchema } from "@/lib/assignments/domain";
import { checkAiLimit, finishUsageRun, startUsageRun } from "@/lib/assignments/usage";
import { prisma } from "@/lib/prisma";

const schema = z.object({ instructions: z.string().trim().min(1).max(4_000) });
export async function POST(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  let runId: string | undefined;
  try {
    const teacher = await requireTeacherApi();
    const { courseId } = await params;
    const course = await ownedCourse(courseId, teacher.id);
    if (!isAiConfigured()) return Response.json({ error: "AI provider is not configured." }, { status: 503 });
    if (course.status !== "READY") throw new ApiError(409, "Confirm course knowledge before requesting suggestions.");
    const limit = await checkAiLimit(teacher.id, courseId);
    if (!limit.allowed) return Response.json({ error: "AI usage limit reached." }, { status: 429, headers: { "retry-after": String(limit.retryAfter) } });
    const input = schema.parse(await request.json());
    const entities = (await prisma.knowledgeEntity.findMany({ where: { courseId } })).map((item) => entitySchema.parse({ ...item, aliases: item.aliases, evidence: item.evidence }));
    const run = await startUsageRun(courseId, teacher.id, "requirements_suggestion");
    runId = run.id;
    const suggestions = await suggestBrief(input.instructions, entities, { courseId, runId, operation: "requirements_suggestion" });
    await finishUsageRun(runId, "SUCCESS");
    return Response.json({ suggestions });
  } catch (error) {
    if (runId) await finishUsageRun(runId, "FAILED", error instanceof Error ? error.message : "Suggestion failed.").catch(() => undefined);
    return apiError(error);
  }
}
