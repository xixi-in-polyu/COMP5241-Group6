import { describe, expect, it } from "vitest";

import harnessProject from "@/animation-studio/content/projects/harness-intro.animation.json";
import { preparePublishedProject } from "@/animation-studio/prepare";

describe("harness introduction", () => {
  it("is a valid two-minute, four-scene animation", () => {
    const prepared = preparePublishedProject(harnessProject);

    expect(prepared.error).toBeNull();
    if (!prepared.project) {
      throw new Error(prepared.error ?? "Missing harness project");
    }

    const project = prepared.project;
    const duration = project.scenes.reduce((sum, scene) => sum + scene.duration, 0);
    const images = project.scenes.flatMap((scene) =>
      scene.elements.filter((element) => element.type === "image"),
    );
    const moves = project.scenes
      .flatMap((scene) => scene.elements)
      .flatMap((element) => element.motion.beats)
      .filter((cue) => cue.preset === "move");

    expect(duration).toBe(120);
    expect(project.scenes).toHaveLength(4);
    expect(project.assets).toHaveLength(4);
    expect(images).toHaveLength(4);
    expect(project.theme.background).toBe("#FFFFFF");
    expect(project.scenes.every((scene) => scene.narration.length === 3)).toBe(true);
    expect(project.scenes.every((scene) => (scene.camera?.zoomTo ?? 1) > 1)).toBe(true);
    expect(moves.length).toBeGreaterThanOrEqual(2);
    expect(images.every((element) => element.motion.ambient === "ken-burns")).toBe(true);
  });
});
