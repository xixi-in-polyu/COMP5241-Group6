import { describe, expect, it } from "vitest";

import { truncateCourseSources } from "@/lib/courses/source-budget";
import { courseCreateSchema, coursePatchSchema, hasPublishableContent } from "@/lib/courses/validation";

const chapter = (blocks: unknown[]) => ({
  title: "Introduction",
  objectives: [],
  resources: [],
  blocks,
});

describe("unified course validation", () => {
  it("normalizes a minimal course draft", () => {
    const course = courseCreateSchema.parse({ title: "A course" });
    expect(course).toMatchObject({
      title: "A course",
      level: "beginner",
      language: "en",
      resources: [],
      chapters: [],
    });
  });

  it("does not turn omitted PATCH fields into destructive updates", () => {
    const raw = { title: "Renamed" };
    const parsed = coursePatchSchema.parse(raw);
    const explicit = Object.fromEntries(Object.keys(raw).map((key) => [key, parsed[key as keyof typeof parsed]]));
    expect(explicit).toEqual({ title: "Renamed" });
    expect(explicit).not.toHaveProperty("chapters");
  });

  it("requires meaningful chapter content for publication", () => {
    expect(hasPublishableContent([chapter([{ type: "text", text: "" }]) as never])).toBe(false);
    expect(hasPublishableContent([chapter([{ type: "heading", text: "Core idea" }]) as never])).toBe(true);
    expect(hasPublishableContent([chapter([{ type: "activity", instruction: "Try it", items: [] }]) as never])).toBe(true);
  });

  it("applies per-source and total AI source budgets in order", () => {
    const result = truncateCourseSources([
      { label: "pasted", text: "a".repeat(8_000) },
      { label: "first file", text: "b".repeat(8_000) },
      { label: "second file", text: "c".repeat(8_000) },
      { label: "starved", text: "d".repeat(8_000) },
    ]);
    expect(result.map((source) => source.text.length)).toEqual([6_000, 6_000, 6_000, 0]);
  });
});
