import { describe, expect, it } from "vitest";

import {
  generatedChapterTitle,
  manualChapterTitles,
  requestedChapterTopics,
} from "@/lib/mini-courses/chapter-topics";

describe("mini-course chapter titles", () => {
  it("keeps empty topics empty for AI naming", () => {
    expect(requestedChapterTopics({
      topics: ["  Architecture  ", ""],
      chapterCount: 2,
      includeReview: true,
      language: "en",
    })).toEqual(["Architecture", "", "Review & extension"]);
  });

  it("uses generic titles only for the manual-writing path", () => {
    expect(manualChapterTitles(["Architecture", "", "Review & extension"], "en"))
      .toEqual(["Architecture", "Chapter 2", "Review & extension"]);
  });

  it("uses an AI title when the author left the topic empty", () => {
    expect(generatedChapterTitle({
      requestedTopic: "",
      generatedTitle: "Dependency Inversion in Practice",
      index: 0,
      language: "en",
    })).toBe("Dependency Inversion in Practice");
  });

  it("preserves an author-provided topic over the generated title", () => {
    expect(generatedChapterTitle({
      requestedTopic: "Architecture Fundamentals",
      generatedTitle: "A Different Title",
      index: 0,
      language: "en",
    })).toBe("Architecture Fundamentals");
  });
});
