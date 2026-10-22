import "server-only";

import { getAiConfig } from "@/lib/ai/config";
import { prisma } from "@/lib/prisma";

/**
 * Records one course-authoring AI attempt in the unified usage log.
 */
export async function recordMiniCourseAiUsage(input: {
  courseId: string;
  userId: string;
  operation: "course_draft" | "course_chapters";
  status: "SUCCESS" | "FAILED";
  durationMs: number;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  errorDetail?: string;
}): Promise<void> {
  let provider = "unknown";
  let model = "unknown";
  try {
    const config = getAiConfig();
    provider = config.provider;
    model = config.model;
  } catch {
    // Configuration problems must not hide the original failure.
  }

  try {
    if (input.courseId) {
      const unified = await prisma.course.findUnique({ where: { id: input.courseId }, select: { id: true } });
      if (unified) {
        await prisma.usageEvent.create({
          data: {
            courseId: unified.id,
            category: "ai",
            operation: input.operation,
            provider,
            model,
            status: input.status.toLowerCase(),
            durationMs: input.durationMs,
            inputTokens: input.usage?.inputTokens ?? null,
            outputTokens: input.usage?.outputTokens ?? null,
            totalTokens: input.usage?.totalTokens ?? null,
            errorDetail: input.errorDetail?.slice(0, 800) ?? null,
            completedAt: new Date(),
          },
        });
        return;
      }
    }
    console.warn("[course-ai-usage] skipped usage without a unified course", {
      operation: input.operation,
      userId: input.userId,
    });
  } catch (error) {
    console.error("[mini-course-ai-usage] could not record usage:", error);
  }
}
