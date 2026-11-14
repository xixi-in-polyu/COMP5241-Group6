import { describe, expect, it } from "vitest";

import {
  getPublishedAnimation,
  listExperimentAnimations,
  listPublishedVersions,
  listTopicAnimations,
} from "@/animation-studio/content/versions/registry";

describe("published animation versions", () => {
  it("exposes the complete archive with v6 as the latest cut", () => {
    const versions = listPublishedVersions();

    expect(versions.map((version) => version.id)).toEqual([
      "v2",
      "v3",
      "v4",
      "v5",
      "v6",
    ]);
    expect(versions.filter((version) => version.latest)).toHaveLength(1);
    expect(versions.at(-1)?.latest).toBe(true);
    expect(versions.every((version) => version.scenes > 0)).toBe(true);
    expect(versions.every((version) => version.durationSeconds > 0)).toBe(true);
    expect(versions.at(-1)?.images).toBeGreaterThanOrEqual(8);
  });

  it("exposes the harness topic intro", () => {
    const topics = listTopicAnimations();

    expect(topics.map((topic) => topic.id)).toEqual(["harness"]);
    expect(topics[0]?.durationSeconds).toBe(120);
    expect(topics[0]?.images).toBe(4);
    expect(getPublishedAnimation("harness")?.project).toBeTruthy();
  });

  it("exposes iteration experiments", () => {
    const experiments = listExperimentAnimations();

    expect(experiments.map((experiment) => experiment.id)).toEqual([
      "prototype-mvp",
      "the-seam-map",
      "editable-diagrams",
      "eighteen-hours",
    ]);
    expect(experiments.map((experiment) => experiment.durationSeconds)).toEqual([
      180.8,
      678,
      22,
      780,
    ]);
    expect(experiments.map((experiment) => experiment.images)).toEqual([
      4,
      6,
      0,
      15,
    ]);
    expect(
      experiments.map((experiment) => Date.parse(experiment.updatedAt)),
    ).toEqual(
      experiments
        .map((experiment) => Date.parse(experiment.updatedAt))
        .toSorted((first, second) => second - first),
    );
    expect(
      experiments.every((experiment) =>
        Boolean(getPublishedAnimation(experiment.id)?.project),
      ),
    ).toBe(true);
  });

  it("rejects an unknown animation", () => {
    expect(getPublishedAnimation("v1")).toBeNull();
    expect(getPublishedAnimation("v6")?.project).toBeTruthy();
  });
});
