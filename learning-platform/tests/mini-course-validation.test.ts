import { describe, expect, it } from "vitest";

import {
  BACKGROUND_FROM_DB,
  BACKGROUND_TO_DB,
  BLOCK_TYPE_FROM_DB,
  BLOCK_TYPE_TO_DB,
  LEVEL_FROM_DB,
  LEVEL_TO_DB,
} from "@/lib/mini-courses/db-enums";
import { toClientCourse } from "@/lib/mini-courses/serialize";
import {
  blockPayload,
  blocksToCreate,
  chapterSchema,
  courseInputSchema,
} from "@/lib/mini-courses/validation";
import type { MiniCourseBlock } from "@/lib/mini-courses/types";

const baseCourse = {
  title: "Debugging JavaScript",
  level: "intermediate" as const,
  background: "experienced" as const,
  durationMinutes: 45,
  language: "en" as const,
};

const heading: MiniCourseBlock = { id: "b1", type: "heading", text: "Reading a stack trace" };
const body: MiniCourseBlock = { id: "b2", type: "text", text: "Start from the first frame." };

describe("enum translation", () => {
  it("round-trips every level and block type", () => {
    for (const [ui, db] of Object.entries(LEVEL_TO_DB)) {
      expect(LEVEL_FROM_DB[db]).toBe(ui);
    }
    for (const [ui, db] of Object.entries(BLOCK_TYPE_TO_DB)) {
      expect(BLOCK_TYPE_FROM_DB[db]).toBe(ui);
    }
    expect(BACKGROUND_FROM_DB[BACKGROUND_TO_DB.experienced]).toBe("experienced");
  });
});

describe("courseInputSchema", () => {
  it("accepts a minimal course and fills the optional fields", () => {
    const parsed = courseInputSchema.parse(baseCourse);
    expect(parsed.summary).toBe("");
    expect(parsed.objectives).toEqual([]);
    expect(parsed.resources).toEqual([]);
    expect(parsed.chapters).toEqual([]);
  });

  it("rejects an empty title, an unknown level and a too short duration", () => {
    expect(courseInputSchema.safeParse({ ...baseCourse, title: "   " }).success).toBe(false);
    expect(courseInputSchema.safeParse({ ...baseCourse, level: "expert" }).success).toBe(false);
    expect(courseInputSchema.safeParse({ ...baseCourse, durationMinutes: 0 }).success).toBe(false);
  });

  it("rejects a chapter holding an unknown block type", () => {
    const result = chapterSchema.safeParse({
      title: "Chapter",
      blocks: [{ type: "quiz", question: "?" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("block payloads", () => {
  it("drops id and type from the JSON payload", () => {
    const payload = blockPayload(body);
    expect(payload).toEqual({ text: "Start from the first frame." });
    expect(payload).not.toHaveProperty("id");
    expect(payload).not.toHaveProperty("type");
  });

  it("numbers blocks and maps their type to the database enum", () => {
    expect(blocksToCreate([heading, body])).toEqual([
      { ordinal: 1, type: "HEADING", payload: { text: "Reading a stack trace" } },
      { ordinal: 2, type: "TEXT", payload: { text: "Start from the first frame." } },
    ]);
  });
});

describe("toClientCourse", () => {
  const row = {
    id: "course-1",
    ownerId: "user-1",
    title: "Debugging JavaScript",
    summary: "A short course.",
    audience: "Developers",
    subject: "Web development",
    objectives: ["Read a stack trace"],
    resources: [{ id: "r1", kind: "link", title: "MDN", url: "https://example.com" }],
    level: "INTERMEDIATE",
    background: "EXPERIENCED",
    durationMinutes: 45,
    language: "en",
    status: "PUBLISHED",
    createdAt: new Date("2026-10-01T10:00:00.000Z"),
    updatedAt: new Date("2026-10-02T10:00:00.000Z"),
    aiUsage: [],
    chapters: [
      {
        id: "chapter-2",
        courseId: "course-1",
        ordinal: 2,
        title: "Second chapter",
        objectives: [],
        resources: [],
        createdAt: new Date("2026-10-01T10:00:00.000Z"),
        updatedAt: new Date("2026-10-01T10:00:00.000Z"),
        blocks: [
          {
            id: "block-2",
            chapterId: "chapter-2",
            ordinal: 1,
            type: "TEXT",
            payload: { text: "Second body" },
            createdAt: new Date("2026-10-01T10:00:00.000Z"),
            updatedAt: new Date("2026-10-01T10:00:00.000Z"),
          },
        ],
      },
      {
        id: "chapter-1",
        courseId: "course-1",
        ordinal: 1,
        title: "First chapter",
        objectives: ["Read it"],
        resources: [],
        createdAt: new Date("2026-10-01T10:00:00.000Z"),
        updatedAt: new Date("2026-10-01T10:00:00.000Z"),
        blocks: [
          {
            id: "block-1",
            chapterId: "chapter-1",
            ordinal: 2,
            type: "SUMMARY",
            payload: { text: "Keep it simple" },
            createdAt: new Date("2026-10-01T10:00:00.000Z"),
            updatedAt: new Date("2026-10-01T10:00:00.000Z"),
          },
          {
            id: "block-0",
            chapterId: "chapter-1",
            ordinal: 1,
            type: "HEADING",
            payload: { text: "Reading a stack trace" },
            createdAt: new Date("2026-10-01T10:00:00.000Z"),
            updatedAt: new Date("2026-10-01T10:00:00.000Z"),
          },
        ],
      },
    ],
  };

  it("maps database enums and JSON payloads back to the UI shape", () => {
    const course = toClientCourse(row as unknown as Parameters<typeof toClientCourse>[0]);
    expect(course.level).toBe("intermediate");
    expect(course.background).toBe("experienced");
    expect(course.status).toBe("published");
    expect(course.objectives).toEqual(["Read a stack trace"]);
    expect(course.resources).toEqual([
      { id: "r1", kind: "link", title: "MDN", url: "https://example.com" },
    ]);
  });

  it("orders chapters and blocks by ordinal", () => {
    const course = toClientCourse(row as unknown as Parameters<typeof toClientCourse>[0]);
    expect(course.chapters.map((chapter) => chapter.id)).toEqual(["chapter-1", "chapter-2"]);
    expect(course.chapters[0].blocks.map((block) => block.id)).toEqual(["block-0", "block-1"]);
    expect(course.chapters[0].blocks[1]).toEqual({
      id: "block-1",
      type: "summary",
      text: "Keep it simple",
    });
  });
});
