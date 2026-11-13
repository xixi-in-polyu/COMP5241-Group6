import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertCourseWritesEnabled: vi.fn(),
  requireCourseUser: vi.fn(),
  requireOwnedCourse: vi.fn(),
  checkMiniCourseAiLimit: vi.fn(),
  loadCourseAiSources: vi.fn(),
  structured: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  apiError(error: unknown) { throw error; },
}));
vi.mock("@/lib/ai/request-config", () => ({ getRequestAiConfig: () => ({ configured: true }) }));
vi.mock("@/lib/courses/auth", () => ({
  assertCourseWritesEnabled: mocks.assertCourseWritesEnabled,
  requireCourseUser: mocks.requireCourseUser,
  requireOwnedCourse: mocks.requireOwnedCourse,
}));
vi.mock("@/lib/mini-courses/ai-limit", () => ({ checkMiniCourseAiLimit: mocks.checkMiniCourseAiLimit }));
vi.mock("@/lib/courses/ai-sources", () => ({ loadCourseAiSources: mocks.loadCourseAiSources }));
vi.mock("@/lib/mini-courses/ai", () => ({
  structured: mocks.structured,
  truncateMaterials: (materials: unknown) => materials,
}));

import { POST } from "@/app/api/ai/course-chapters/route";

const courseId = "5a71faef-0c34-45df-9628-431932d71bbc";

describe("mini-course chapter generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCourseUser.mockResolvedValue({ id: "user-1" });
    mocks.requireOwnedCourse.mockResolvedValue({ id: courseId });
    mocks.checkMiniCourseAiLimit.mockResolvedValue(undefined);
    mocks.loadCourseAiSources.mockResolvedValue([]);
    mocks.structured.mockImplementation(async ({ data }: { data: { chapterTopic: string } }) => {
      if (data.chapterTopic === "Broken topic") throw new Error("model returned empty output");
      return {
        title: data.chapterTopic,
        sections: [
          { heading: "First section", body: "A sufficiently long generated section body that satisfies the response schema for testing." },
          { heading: "Second section", body: "Another sufficiently long generated section body that satisfies the response schema for testing." },
        ],
        summary: "Chapter summary.",
      };
    });
  });

  it("returns successful chapters and a null fallback for failed chapters", async () => {
    const response = await POST(new Request("http://localhost/api/ai/course-chapters", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        courseId,
        language: "en",
        title: "Software development",
        subject: "SDLC",
        audience: "Students",
        level: "beginner",
        objectives: [],
        chapterTopics: ["Introduction", "Broken topic", "Testing"],
      }),
    }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.chapters).toHaveLength(3);
    expect(body.chapters[0]).toEqual(expect.objectContaining({ title: "Introduction" }));
    expect(body.chapters[1]).toBeNull();
    expect(body.chapters[2]).toEqual(expect.objectContaining({ title: "Testing" }));
    expect(body.failures).toEqual([{ index: 1, title: "Chapter 2" }]);
    expect(mocks.structured).toHaveBeenCalledTimes(3);
    expect(mocks.structured).toHaveBeenCalledWith(expect.objectContaining({ maxTokens: 4_000 }));
  });
});
