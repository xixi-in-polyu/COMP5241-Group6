import type {
  MiniCourse as MiniCourseRow,
  MiniCourseBlock as BlockRow,
  MiniCourseChapter as ChapterRow,
  Prisma,
} from "@prisma/client";

import {
  BACKGROUND_FROM_DB,
  BLOCK_TYPE_FROM_DB,
  LEVEL_FROM_DB,
  STATUS_FROM_DB,
} from "./db-enums";
import type {
  LearnerBackground,
  MiniCourse,
  MiniCourseBlock,
  MiniCourseChapter,
  MiniCourseLevel,
  MiniCourseResource,
  MiniCourseStatus,
} from "./types";

/**
 * Prisma stores enums in upper case and blocks as a type plus a JSON payload;
 * the UI works with lower-case unions and one discriminated block union. This
 * module is the only place that translation happens, and it touches no database
 * client so it can be unit tested directly.
 */

type Payload = Record<string, unknown>;

type RowWithChapters = MiniCourseRow & {
  chapters: (ChapterRow & { blocks: BlockRow[] })[];
};

function asPayload(value: Prisma.JsonValue | null): Payload {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Payload)
    : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Splits a stored block into the UI union without trusting the payload shape. */
export function toClientBlock(row: BlockRow): MiniCourseBlock {
  const payload = asPayload(row.payload);
  const type = BLOCK_TYPE_FROM_DB[row.type] ?? "text";

  switch (type) {
    case "heading":
    case "text":
    case "summary":
      return { id: row.id, type, text: asString(payload.text) };
    case "image":
      return {
        id: row.id,
        type,
        url: asString(payload.url),
        caption: asString(payload.caption),
      };
    case "video":
      return {
        id: row.id,
        type,
        url: asString(payload.url),
        title: asString(payload.title),
      };
    case "file":
      return {
        id: row.id,
        type,
        url: asString(payload.url),
        title: asString(payload.title),
        description: asString(payload.description),
      };
    case "activity": {
      const items = Array.isArray(payload.items) ? payload.items : [];
      return {
        id: row.id,
        type,
        instruction: asString(payload.instruction),
        items: items.map((item, index) => {
          const entry = (item ?? {}) as Payload;
          return {
            id: asString(entry.id) || `${row.id}-item-${index}`,
            text: asString(entry.text),
          };
        }),
      };
    }
  }
}

export function asResources(value: Prisma.JsonValue): MiniCourseResource[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }
    const entry = item as Payload;
    const kind = asString(entry.kind);
    if (kind !== "link" && kind !== "video" && kind !== "file") {
      return [];
    }
    return [
      {
        id: asString(entry.id),
        kind,
        title: asString(entry.title),
        url: asString(entry.url),
      },
    ];
  });
}

function asStringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/** Converts one database row (with chapters and blocks) into the UI shape. */
export function toClientCourse(row: RowWithChapters): MiniCourse {
  const chapters: MiniCourseChapter[] = row.chapters
    .slice()
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      objectives: asStringArray(chapter.objectives),
      resources: asResources(chapter.resources),
      blocks: chapter.blocks
        .slice()
        .sort((a, b) => a.ordinal - b.ordinal)
        .map(toClientBlock),
    }));

  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    audience: row.audience,
    objectives: asStringArray(row.objectives),
    subject: row.subject,
    level: (LEVEL_FROM_DB[row.level] ?? "beginner") as MiniCourseLevel,
    background: (BACKGROUND_FROM_DB[row.background] ?? "experienced") as LearnerBackground,
    durationMinutes: row.durationMinutes,
    language: row.language === "zh" ? "zh" : "en",
    status: (STATUS_FROM_DB[row.status] ?? "draft") as MiniCourseStatus,
    ownerId: row.ownerId,
    ownerRole: "teacher",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resources: asResources(row.resources),
    chapters,
  };
}
