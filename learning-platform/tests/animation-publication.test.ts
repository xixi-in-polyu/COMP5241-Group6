import { describe, expect, it } from "vitest";

import publishedProject from "@/animation-studio/content/published.animation.json";
import { preparePublishedProject } from "@/animation-studio/prepare";

describe("published animation", () => {
  it("loads a valid project for the studio", () => {
    const prepared = preparePublishedProject(publishedProject);

    expect(prepared.error).toBeNull();
    if (!prepared.project) {
      throw new Error(prepared.error ?? "Missing published project");
    }

    expect(prepared.project.schemaVersion).toBe(5);
    expect(prepared.project.scenes.length).toBeGreaterThan(0);
    expect(prepared.project.chapters.length).toBeGreaterThan(0);
  });
});
