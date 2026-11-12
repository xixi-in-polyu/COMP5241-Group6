import v2 from "./published.animation-v2.json";
import v3 from "./published.animation-v3.json";
import v4 from "./published.animation-v4.json";
import v5 from "./published.animation-v5.json";
import v6 from "./published.animation-v6.json";

type ProjectShape = {
  scenes?: Array<{
    duration?: number;
    elements?: Array<{ type?: string }>;
  }>;
};

type VersionDefinition = {
  id: "v2" | "v3" | "v4" | "v5" | "v6";
  label: string;
  description: string;
  tags: string[];
  project: unknown;
};

export type PublishedVersion = {
  id: VersionDefinition["id"];
  label: string;
  description: string;
  tags: string[];
  project: unknown;
  scenes: number;
  durationSeconds: number;
  durationLabel: string;
  images: number;
  latest: boolean;
};

const definitions: VersionDefinition[] = [
  {
    id: "v2",
    label: "V2 · Original export",
    description:
      "The first Storyline Studio export: twelve 65-second scenes, three elements per scene, and one entrance followed by emphasis pulses.",
    tags: ["12 scenes", "3 elements per scene", "no step layer"],
    project: v2,
  },
  {
    id: "v3",
    label: "V3 · Step layer",
    description:
      "Four steps per scene, 63 elements, step callouts, a quieter pulse budget, and a 1.5-second quiet hold.",
    tags: ["4 steps per scene", "63 elements", "12 scenes"],
    project: v3,
  },
  {
    id: "v4",
    label: "V4 · First illustrations",
    description:
      "Deployment and secret-boundary diagrams enter the project, with step-scoped images and a slow ken-burns ambient.",
    tags: ["4 illustrations", "ken-burns", "step-scoped images"],
    project: v4,
  },
  {
    id: "v5",
    label: "V5 · Full illustration pass",
    description:
      "Architecture, verification/validation, incident, and availability illustrations; a fraction formula; flat scene chrome with no footer.",
    tags: ["8 illustrations", "fraction formula", "flat chrome"],
    project: v5,
  },
  {
    id: "v6",
    label: "V6 · Natural motion",
    description:
      "Pure white paper, a cosine-eased camera push/pan on every scene, and move cues that shift images between steps.",
    tags: ["white paper", "camera", "move cues"],
    project: v6,
  },
];

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function listPublishedVersions(): PublishedVersion[] {
  return definitions.map((definition) => {
    const project = definition.project as ProjectShape;
    const scenes = project.scenes?.length ?? 0;
    const durationSeconds =
      project.scenes?.reduce((sum, scene) => sum + (scene.duration ?? 0), 0) ?? 0;
    const images =
      project.scenes?.reduce(
        (count, scene) =>
          count +
          (scene.elements ?? []).filter((element) => element.type === "image")
            .length,
        0,
      ) ?? 0;

    return {
      ...definition,
      scenes,
      durationSeconds,
      durationLabel: formatDuration(durationSeconds),
      images,
      latest: definition.id === "v6",
    };
  });
}

export function getPublishedVersion(id: string) {
  return definitions.find((definition) => definition.id === id) ?? null;
}
