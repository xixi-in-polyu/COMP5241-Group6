import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canCapturePayload, payloadInfo, sanitizeContext } from "./usage-core";

const EVENT_LIMIT = () => Number(process.env.USAGE_CONTEXT_MAX_EVENT_BYTES || 2 * 1024 * 1024);
const COURSE_LIMIT = () => Number(process.env.USAGE_CONTEXT_MAX_COURSE_BYTES || 100 * 1024 * 1024);
const RETENTION_DAYS = () => Number(process.env.USAGE_CONTEXT_RETENTION_DAYS || 30);

export { sanitizeContext };

export async function checkAiLimit(teacherId: string, courseId: string) {
  const now = new Date();
  const hourKey = now.toISOString().slice(0, 13);
  const dayKey = now.toISOString().slice(0, 10);
  const limits = { hour: Number(process.env.AI_HOURLY_LIMIT || 20), day: Number(process.env.AI_DAILY_LIMIT || 200) };
  return prisma.$transaction(async (tx) => {
    for (const [windowKind, windowKey] of [["hour", hourKey], ["day", dayKey]] as const) {
      const bucket = await tx.usageBucket.upsert({
        where: { teacherId_windowKind_windowKey: { teacherId, windowKind, windowKey } },
        create: { teacherId, courseId, windowKind, windowKey, count: 0 },
        update: {},
      });
      if (bucket.count >= limits[windowKind]) return { allowed: false, windowKind, retryAfter: windowKind === "hour" ? 3600 : 86400 } as const;
    }
    await Promise.all([
      tx.usageBucket.update({ where: { teacherId_windowKind_windowKey: { teacherId, windowKind: "hour", windowKey: hourKey } }, data: { count: { increment: 1 } } }),
      tx.usageBucket.update({ where: { teacherId_windowKind_windowKey: { teacherId, windowKind: "day", windowKey: dayKey } }, data: { count: { increment: 1 } } }),
    ]);
    return { allowed: true } as const;
  }, { isolationLevel: "Serializable" });
}

export async function startUsageRun(courseId: string, teacherId: string, kind: string, assignmentId?: string) {
  return prisma.usageRun.create({ data: { courseId, teacherId, kind, assignmentId }, select: { id: true } });
}

export async function finishUsageRun(id: string, status: "SUCCESS" | "FAILED", error?: string) {
  await prisma.usageRun.update({ where: { id }, data: { status, error, completedAt: new Date() } });
}

type EventInput = {
  runId?: string;
  courseId: string;
  assignmentId?: string;
  operation: string;
  provider?: string;
  model?: string;
  request?: unknown;
  metadata?: Record<string, unknown>;
  attempt?: number;
};

export async function startUsageEvent(input: EventInput) {
  const item = input.request === undefined ? null : payloadInfo(input.request);
  const [storedRequests, storedResponses] = await Promise.all([
    prisma.usageEvent.aggregate({ where: { courseId: input.courseId, requestPayload: { not: Prisma.DbNull } }, _sum: { requestBytes: true } }),
    prisma.usageEvent.aggregate({ where: { courseId: input.courseId, responsePayload: { not: Prisma.DbNull } }, _sum: { responseBytes: true } }),
  ]);
  const storedBytes = (storedRequests._sum.requestBytes || 0) + (storedResponses._sum.responseBytes || 0);
  const canStore = Boolean(item && canCapturePayload(item.bytes, storedBytes, EVENT_LIMIT(), COURSE_LIMIT()));
  const event = await prisma.usageEvent.create({
    data: {
      runId: input.runId,
      courseId: input.courseId,
      assignmentId: input.assignmentId,
      category: "ai",
      operation: input.operation,
      provider: input.provider,
      model: input.model,
      status: "running",
      attempt: input.attempt || 1,
      requestPayload: canStore ? item!.clean as Prisma.InputJsonValue : undefined,
      requestBytes: item?.bytes || 0,
      metadata: { ...(input.metadata || {}), requestHash: item?.hash, contextStatus: canStore ? "full" : item ? "metadata_only" : "none" },
      payloadExpiresAt: canStore ? new Date(Date.now() + RETENTION_DAYS() * 86400_000) : undefined,
    },
    select: { id: true, createdAt: true, requestBytes: true, requestPayload: true },
  });
  return event;
}

export async function finishUsageEvent(id: string, input: { status: string; response?: unknown; inputTokens?: number | null; outputTokens?: number | null; totalTokens?: number | null; providerRequestId?: string; errorCode?: string; errorDetail?: string }) {
  const current = await prisma.usageEvent.findUniqueOrThrow({ where: { id } });
  const item = input.response === undefined ? null : payloadInfo(input.response);
  const [storedRequests, storedResponses] = await Promise.all([
    prisma.usageEvent.aggregate({ where: { courseId: current.courseId, requestPayload: { not: Prisma.DbNull } }, _sum: { requestBytes: true } }),
    prisma.usageEvent.aggregate({ where: { courseId: current.courseId, responsePayload: { not: Prisma.DbNull } }, _sum: { responseBytes: true } }),
  ]);
  const storedBytes = (storedRequests._sum.requestBytes || 0) + (storedResponses._sum.responseBytes || 0);
  const combined = current.requestBytes + (item?.bytes || 0);
  const storedBeforeEvent = Math.max(0, storedBytes - (current.requestPayload ? current.requestBytes : 0));
  const canStore = Boolean(item && canCapturePayload(combined, storedBeforeEvent, EVENT_LIMIT(), COURSE_LIMIT()));
  await prisma.usageEvent.update({
    where: { id },
    data: {
      status: input.status,
      completedAt: new Date(),
      durationMs: Date.now() - current.createdAt.getTime(),
      responsePayload: canStore ? item!.clean as Prisma.InputJsonValue : undefined,
      responseBytes: item?.bytes || 0,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      totalTokens: input.totalTokens,
      providerRequestId: input.providerRequestId,
      errorCode: input.errorCode,
      errorDetail: input.errorDetail,
      ...(!canStore && item ? { requestPayload: Prisma.DbNull, payloadExpiresAt: null, metadata: { ...(current.metadata as object), contextStatus: "metadata_only", responseHash: item.hash } } : {}),
    },
  });
}

export async function clearExpiredUsagePayloads(now = new Date()) {
  return prisma.usageEvent.updateMany({
    where: { payloadExpiresAt: { lte: now } },
    data: { requestPayload: Prisma.DbNull, responsePayload: Prisma.DbNull, payloadExpiresAt: null },
  });
}
