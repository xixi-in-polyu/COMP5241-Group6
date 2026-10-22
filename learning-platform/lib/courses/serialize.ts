import type { Prisma } from "@prisma/client";

import type {
  CourseBlock,
  CourseChapter,
  CourseMaterial,
  CourseResource,
  UnifiedCourse,
} from "./types";

export const COURSE_INCLUDE = {
  owner: { select: { role: true } },
  teacher: { select: { role: true } },
  resources: { orderBy: { ordinal: "asc" } },
  materials: { where: { chapterId: null }, orderBy: { createdAt: "asc" } },
  chapters: {
    orderBy: { ordinal: "asc" },
    include: {
      blocks: { orderBy: { ordinal: "asc" } },
      resources: { orderBy: { ordinal: "asc" } },
      materials: { orderBy: { createdAt: "asc" } },
    },
  },
  _count: { select: { assignments: true } },
} satisfies Prisma.CourseInclude;

export type CourseWithContent = Prisma.CourseGetPayload<{ include: typeof COURSE_INCLUDE }>;

const asStrings = (value: Prisma.JsonValue): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const asRecord = (value: Prisma.JsonValue): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const stringValue = (value: unknown) => (typeof value === "string" ? value : "");

export function serializeResource(resource: CourseWithContent["resources"][number]): CourseResource {
  return {
    id: resource.id,
    kind: resource.kind.toLowerCase() as CourseResource["kind"],
    title: resource.title,
    url: resource.url,
  };
}

export function serializeMaterial(
  material: CourseWithContent["materials"][number],
): CourseMaterial {
  return {
    id: material.id,
    chapterId: material.chapterId,
    kind: material.kind.toLowerCase() as CourseMaterial["kind"],
    name: material.name,
    mimeType: material.mimeType,
    size: material.size,
    status: material.status.toLowerCase() as CourseMaterial["status"],
    aiSelected: material.aiSelected,
    pageCount: material.pageCount,
    errorCode: material.errorCode,
    errorDetail: material.errorDetail,
    createdAt: material.createdAt.toISOString(),
  };
}

export function serializeBlock(
  block: CourseWithContent["chapters"][number]["blocks"][number],
): CourseBlock {
  const payload = asRecord(block.payload);
  const id = block.id;
  switch (block.type) {
    case "HEADING":
      return { id, type: "heading", text: stringValue(payload.text) };
    case "TEXT":
      return { id, type: "text", text: stringValue(payload.text) };
    case "SUMMARY":
      return { id, type: "summary", text: stringValue(payload.text) };
    case "IMAGE":
      return { id, type: "image", url: stringValue(payload.url), caption: stringValue(payload.caption) };
    case "VIDEO":
      return { id, type: "video", url: stringValue(payload.url), title: stringValue(payload.title) };
    case "FILE":
      return {
        id,
        type: "file",
        url: stringValue(payload.url),
        title: stringValue(payload.title),
        description: stringValue(payload.description),
      };
    case "ACTIVITY": {
      const items = Array.isArray(payload.items) ? payload.items : [];
      return {
        id,
        type: "activity",
        instruction: stringValue(payload.instruction),
        items: items.map((item, index) => {
          const value = item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : {};
          return { id: stringValue(value.id) || `${id}-${index}`, text: stringValue(value.text) };
        }),
      };
    }
  }
}

export function serializeCourse(course: CourseWithContent): UnifiedCourse {
  const chapters: CourseChapter[] = course.chapters.map((chapter) => ({
    id: chapter.id,
    title: chapter.title,
    objectives: asStrings(chapter.objectives),
    resources: chapter.resources.map(serializeResource),
    materials: chapter.materials.map(serializeMaterial),
    blocks: chapter.blocks.map(serializeBlock),
  }));
  const ownerId = course.ownerId ?? course.teacherId;
  if (!ownerId) throw new Error(`Course ${course.id} has no owner.`);

  return {
    id: course.id,
    title: course.title,
    description: course.description,
    subject: course.subject,
    audience: course.audience,
    objectives: asStrings(course.objectives),
    level: course.level.toLowerCase() as UnifiedCourse["level"],
    background: course.background.toLowerCase() as UnifiedCourse["background"],
    durationMinutes: course.durationMinutes,
    language: course.language === "zh" ? "zh" : "en",
    publicationStatus: course.publicationStatus.toLowerCase() as UnifiedCourse["publicationStatus"],
    knowledgeStatus: course.status,
    knowledgeStale: course.knowledgeStale,
    archivedAt: course.archivedAt?.toISOString() ?? null,
    ownerId,
    ownerRole: course.owner?.role === "student" ? "student" : course.teacher?.role === "student" ? "student" : "teacher",
    createdAt: course.createdAt.toISOString(),
    updatedAt: course.updatedAt.toISOString(),
    resources: course.resources.filter((item) => !item.chapterId).map(serializeResource),
    materials: course.materials.map(serializeMaterial),
    chapters,
    assignmentCount: course._count.assignments,
  };
}
