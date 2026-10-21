import "server-only";

import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

/**
 * Per-user AI budget for mini-courses.
 *
 * The assignment pipeline keeps counters in `UsageBucket`, which requires a
 * Course foreign key — mini-courses are not Course rows. Every AI attempt is
 * already recorded in `MiniCourseAiUsage`, so counting recent rows gives the
 * same guard without a second bookkeeping table.
 *
 * The window sizes are the project-wide `AI_HOURLY_LIMIT` / `AI_DAILY_LIMIT`
 * knobs, so operators tune one pair of variables for every AI feature.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export async function checkMiniCourseAiLimit(userId: string): Promise<void> {
  const hourlyLimit = Number(process.env.AI_HOURLY_LIMIT || 20);
  const dailyLimit = Number(process.env.AI_DAILY_LIMIT || 200);

  const now = Date.now();
  const [hourCount, dayCount] = await Promise.all([
    prisma.miniCourseAiUsage.count({
      where: { userId, createdAt: { gte: new Date(now - HOUR_MS) } },
    }),
    prisma.miniCourseAiUsage.count({
      where: { userId, createdAt: { gte: new Date(now - DAY_MS) } },
    }),
  ]);

  if (hourCount >= hourlyLimit) {
    throw new ApiError(429, `AI limit reached (${hourlyLimit} requests per hour). Try again later.`);
  }
  if (dayCount >= dailyLimit) {
    throw new ApiError(429, `AI limit reached (${dailyLimit} requests per day). Try again later.`);
  }
}
