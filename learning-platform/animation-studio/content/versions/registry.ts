import editableDiagrams from "../projects/editable-diagrams.animation.json";
import eighteenHours from "../projects/eighteen-hours-to-learn.animation.json";
import harness from "../projects/harness-intro.animation.json";
import prototypeMvp from "../projects/prototype-mvp.animation.json";
import seamMap from "../projects/the-seam-map.animation.json";
import v2 from "./published.animation-v2.json";
import v3 from "./published.animation-v3.json";
import v4 from "./published.animation-v4.json";
import v5 from "./published.animation-v5.json";
import v6 from "./published.animation-v6.json";

type ProjectShape = {
  createdAt?: string;
  updatedAt?: string;
  scenes?: Array<{
    duration?: number;
    elements?: Array<{ type?: string }>;
  }>;
};

type Definition = {
  id: string;
  kind: "version" | "topic" | "experiment";
  label: string;
  description: string;
  tags: string[];
  project: unknown;
};

export type PublishedAnimation = {
  id: string;
  kind: Definition["kind"];
  label: string;
  description: string;
  tags: string[];
  project: unknown;
  scenes: number;
  durationSeconds: number;
  durationLabel: string;
  images: number;
  updatedAt: string;
  latest: boolean;
};

const definitions: Definition[] = [
  {
    id: "v2",
    kind: "version",
    label: "V2 · Original export",
    description:
      "The first Storyline Studio export: twelve 65-second scenes, three elements per scene, and one entrance followed by emphasis pulses.",
    tags: ["12 scenes", "3 elements per scene", "no step layer"],
    project: v2,
  },
  {
    id: "v3",
    kind: "version",
    label: "V3 · Step layer",
    description:
      "Four steps per scene, 63 elements, step callouts, a quieter pulse budget, and a 1.5-second quiet hold.",
    tags: ["4 steps per scene", "63 elements", "12 scenes"],
    project: v3,
  },
  {
    id: "v4",
    kind: "version",
    label: "V4 · First illustrations",
    description:
      "Deployment and secret-boundary diagrams enter the project, with step-scoped images and a slow ken-burns ambient.",
    tags: ["4 illustrations", "ken-burns", "step-scoped images"],
    project: v4,
  },
  {
    id: "v5",
    kind: "version",
    label: "V5 · Full illustration pass",
    description:
      "Architecture, verification/validation, incident, and availability illustrations; a fraction formula; flat scene chrome with no footer.",
    tags: ["8 illustrations", "fraction formula", "flat chrome"],
    project: v5,
  },
  {
    id: "v6",
    kind: "version",
    label: "V6 · Natural motion",
    description:
      "Pure white paper, a cosine-eased camera push/pan on every scene, and move cues that shift images between steps.",
    tags: ["white paper", "camera", "move cues"],
    project: v6,
  },
  {
    id: "harness",
    kind: "topic",
    label: "Harness · 2-minute intro",
    description:
      "A four-scene introduction to the runtime around the model: tools, context, boundaries, the agent loop, and what to look for when judging an agent.",
    tags: ["2 min", "4 scenes", "4 illustrations"],
    project: harness,
  },
  {
    id: "editable-diagrams",
    kind: "experiment",
    label: "Editable diagrams",
    description:
      "A short node-and-edge experiment for editable branching diagrams and staged relationship reveals.",
    tags: ["22 sec", "2 scenes", "diagram model"],
    project: editableDiagrams,
  },
  {
    id: "eighteen-hours",
    kind: "experiment",
    label: "Eighteen Hours to Learn",
    description:
      "An incident-led SDLC reconstruction that tests source-grounded imagery across a complete thirteen-minute lesson.",
    tags: ["13 min", "12 scenes", "source-grounded"],
    project: eighteenHours,
  },
  {
    id: "prototype-mvp",
    kind: "experiment",
    label: "Prototype and MVP",
    description:
      "A Chinese three-minute lesson testing source images, diagrams, and the distinction between prototypes and MVPs.",
    tags: ["3 min", "8 scenes", "source images"],
    project: prototypeMvp,
  },
  {
    id: "the-seam-map",
    kind: "experiment",
    label: "The Seam Map",
    description:
      "An eleven-minute SDLC explainer that treats development as a chain of evidence, supported by source images and recorded narration.",
    tags: ["11 min", "13 scenes", "recorded narration"],
    project: seamMap,
  },
];

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function build(definition: Definition): PublishedAnimation {
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
    updatedAt: project.updatedAt ?? project.createdAt ?? "",
    latest: definition.id === "v6",
  };
}

function byUpdatedAtDescending(
  first: PublishedAnimation,
  second: PublishedAnimation,
) {
  return (Date.parse(second.updatedAt) || 0) - (Date.parse(first.updatedAt) || 0);
}

export function listPublishedVersions(): PublishedAnimation[] {
  return definitions
    .filter((definition) => definition.kind === "version")
    .map(build);
}

export function listTopicAnimations(): PublishedAnimation[] {
  return definitions
    .filter((definition) => definition.kind === "topic")
    .map(build);
}

export function listExperimentAnimations(): PublishedAnimation[] {
  return definitions
    .filter((definition) => definition.kind === "experiment")
    .map(build)
    .sort(byUpdatedAtDescending);
}

export function getPublishedAnimation(id: string) {
  const definition = definitions.find((candidate) => candidate.id === id);
  return definition ? build(definition) : null;
}
