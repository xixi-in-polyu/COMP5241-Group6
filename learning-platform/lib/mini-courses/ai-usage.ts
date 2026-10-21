import "server-only";

import { getAiConfig } from "@/lib/ai/config";
import { prisma } from "@/lib/prisma";

/**
 * Records one AI attempt against a mini-course.
 *
 * Deliberately a separate table from UsageEvent: that one requires a Course
 * foreign key, and mini-courses are not Course rows. Same database, same
 * provider/model fields, no change to existing tables.
 */
export async function recordMiniCourseAiUsage(input: {
  courseId?: string | null;
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
    await prisma.miniCourseAiUsage.create({
      data: {
        courseId: input.courseId ?? null,
        userId: input.userId,
        operation: input.operation,
        provider,
        model,
        status: input.status,
        inputTokens: input.usage?.inputTokens ?? null,
        outputTokens: input.usage?.outputTokens ?? null,
        totalTokens: input.usage?.totalTokens ?? null,
        durationMs: input.durationMs,
        errorDetail: input.errorDetail?.slice(0, 800) ?? null,
      },
    });
  } catch (error) {
    console.error("[mini-course-ai-usage] could not record usage:", error);
  }
}
