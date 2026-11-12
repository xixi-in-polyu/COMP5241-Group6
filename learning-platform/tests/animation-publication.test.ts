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

    const images = prepared.project.scenes
      .flatMap((scene) => scene.elements)
      .filter((element) => element.type === "image");

    expect(prepared.project.assets.length).toBeGreaterThanOrEqual(8);
    expect(images.length).toBeGreaterThanOrEqual(8);
    expect(images.every((element) => element.assetId && element.alt)).toBe(true);
    expect(images.every((element) => element.motion.ambient === "ken-burns")).toBe(true);
    expect(
      prepared.project.scenes.every((scene) => (scene.camera?.zoomTo ?? 1) > 1),
    ).toBe(true);
    expect(
      prepared.project.scenes
        .flatMap((scene) => scene.elements)
        .flatMap((element) => element.motion.beats)
        .filter((cue) => cue.preset === "move").length,
    ).toBeGreaterThanOrEqual(3);
  });
});
