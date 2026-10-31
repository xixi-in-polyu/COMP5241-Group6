import "server-only";

import type { Prisma } from "@prisma/client";

import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { segmentUnits } from "@/lib/materials/segment";
import type { z } from "zod";
import type { courseCreateSchema } from "./validation";

type CourseInput = z.infer<typeof courseCreateSchema>;
const json = (value: unknown) => value as Prisma.InputJsonValue;
export const COURSE_CONTENT_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 } as const;

const level = (value: CourseInput["level"]) => value.toUpperCase() as "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
const background = (value: CourseInput["background"]) => value.toUpperCase() as "BEGINNER" | "EXPERIENCED";
const resourceKind = (value: "link" | "video" | "file") => value.toUpperCase() as "LINK" | "VIDEO" | "FILE";

function blockData(block: CourseInput["chapters"][number]["blocks"][number], ordinal: number) {
  const payload = { ...block } as Record<string, unknown>;
  const id = typeof payload.id === "string" ? payload.id : undefined;
  const type = String(payload.type).toUpperCase() as "HEADING" | "TEXT" | "IMAGE" | "VIDEO" | "FILE" | "ACTIVITY" | "SUMMARY";
  delete payload.id;
  delete payload.type;
  return { ...(id ? { id } : {}), ordinal, type, payload: json(payload) };
}

export async function createUnifiedCourse(owner: { id: string; role: string }, input: CourseInput) {
  return prisma.$transaction(async (tx) => {
    const draftCount = await tx.course.count({
      where: {
        OR: [{ ownerId: owner.id }, { ownerId: null, teacherId: owner.id }],
        publicationStatus: "DRAFT",
        archivedAt: null,
      },
    });
    if (draftCount >= 20) {
      throw new ApiError(422, "You already have 20 drafts. Publish or archive one before creating another.");
    }

    const course = await tx.course.create({
      data: {
        ownerId: owner.id,
        teacherId: owner.role === "teacher" ? owner.id : null,
        title: input.title,
        description: input.description,
        category: input.subject || null,
        subject: input.subject,
        audience: input.audience,
        objectives: json(input.objectives),
        level: level(input.level),
        background: background(input.background),
        durationMinutes: input.durationMinutes,
        language: input.language,
        publicationStatus: "DRAFT",
        status: "READY",
        phase: "Ready to edit course content",
      },
      select: { id: true },
    });
    await replaceCourseContent(tx, course.id, input, false);
    return course;
  }, COURSE_CONTENT_TRANSACTION_OPTIONS);
}

export async function replaceCourseContent(
  tx: Prisma.TransactionClient,
  courseId: string,
  input: CourseInput,
  updateCourse = true,
) {
  if (updateCourse) {
    await tx.course.update({
      where: { id: courseId },
      data: {
        title: input.title,
        description: input.description,
        category: input.subject || null,
        subject: input.subject,
        audience: input.audience,
        objectives: json(input.objectives),
        level: level(input.level),
        background: background(input.background),
        durationMinutes: input.durationMinutes,
        language: input.language,
        publicationStatus: "DRAFT",
        shareTokenHash: null,
        knowledgeStale: true,
      },
    });
  }

  await tx.courseResource.deleteMany({ where: { courseId } });
  if (input.resources.length) {
    await tx.courseResource.createMany({
      data: input.resources.map((resource, index) => ({
        courseId,
        kind: resourceKind(resource.kind),
        title: resource.title,
        url: resource.url,
        ordinal: index + 1,
      })),
    });
  }

  const existing = await tx.courseChapter.findMany({ where: { courseId }, select: { id: true } });
  const incomingIds = new Set(input.chapters.flatMap((chapter) => chapter.id ? [chapter.id] : []));
  const removed = existing.filter((chapter) => !incomingIds.has(chapter.id)).map((chapter) => chapter.id);
  if (removed.length) {
    await tx.courseMaterial.updateMany({ where: { chapterId: { in: removed }, courseId }, data: { chapterId: null } });
    await tx.courseChapter.deleteMany({ where: { id: { in: removed }, courseId } });
  }
  const retained = existing.filter((chapter) => !removed.includes(chapter.id));
  if (retained.length) {
    for (const [index, chapter] of retained.entries()) {
      await tx.courseChapter.update({ where: { id: chapter.id }, data: { ordinal: 10_000 + index } });
    }
  }

  for (const [chapterIndex, chapter] of input.chapters.entries()) {
    const chapterId = chapter.id && existing.some((item) => item.id === chapter.id)
      ? chapter.id
      : crypto.randomUUID();
    await tx.courseChapter.upsert({
      where: { id: chapterId },
      create: {
        id: chapterId,
        courseId,
        ordinal: chapterIndex + 1,
        title: chapter.title,
        objectives: json(chapter.objectives),
      },
      update: { ordinal: chapterIndex + 1, title: chapter.title, objectives: json(chapter.objectives) },
    });
    await tx.courseBlock.deleteMany({ where: { chapterId } });
    if (chapter.blocks.length) {
      await tx.courseBlock.createMany({
        data: chapter.blocks.map((block, index) => ({ chapterId, ...blockData(block, index + 1) })),
      });
    }
    if (chapter.resources.length) {
      await tx.courseResource.createMany({
        data: chapter.resources.map((resource, index) => ({
          courseId,
          chapterId,
          kind: resourceKind(resource.kind),
          title: resource.title,
          url: resource.url,
          ordinal: index + 1,
        })),
      });
    }
  }

  if (input.pastedNotes !== undefined) {
    const current = await tx.courseMaterial.findFirst({ where: { courseId, kind: "TEXT", chapterId: null } });
    const text = input.pastedNotes.trim();
    if (!text && current) {
      await tx.courseMaterial.delete({ where: { id: current.id } });
    } else if (text) {
      const data = {
        name: "Pasted notes.txt",
        mimeType: "text/plain; charset=utf-8",
        size: Buffer.byteLength(text, "utf8"),
        textContent: text,
        status: "READY" as const,
        aiSelected: true,
      };
      const material = current
        ? await tx.courseMaterial.update({ where: { id: current.id }, data })
        : await tx.courseMaterial.create({ data: { ...data, courseId, kind: "TEXT" } });
      const segments = segmentUnits([{ locator: { label: "Pasted notes" }, text }]);
      await tx.sourceSegment.deleteMany({ where: { materialId: material.id } });
      await tx.sourceSegment.createMany({
        data: segments.map((segment) => ({
          courseId,
          materialId: material.id,
          ordinal: segment.ordinal,
          locator: json(segment.locator),
          rawText: segment.text,
          normalizedText: segment.text,
          hash: segment.hash,
        })),
      });
    }
  }
}
