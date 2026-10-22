import type {
  BlockType,
  LearnerBackground,
  MiniCourseLevel,
  MiniCourseStatus,
} from "./types";

export const LEVELS: readonly { value: MiniCourseLevel; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

export const BACKGROUNDS: readonly {
  value: LearnerBackground;
  label: string;
  short: string;
}[] = [
  { value: "beginner", label: "No coding experience needed", short: "No coding needed" },
  {
    value: "experienced",
    label: "Some software-development experience",
    short: "Coding background",
  },
];

export const STATUS_LABELS: Record<MiniCourseStatus, string> = {
  draft: "Draft",
  published: "Published",
};

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  heading: "Heading",
  text: "Text",
  image: "Image",
  video: "Video",
  file: "File",
  activity: "Activity",
  summary: "Summary",
};

export function labelForLevel(value: MiniCourseLevel): string {
  return LEVELS.find((option) => option.value === value)?.label ?? value;
}

export function labelForBackground(value: LearnerBackground): string {
  return BACKGROUNDS.find((option) => option.value === value)?.label ?? value;
}

export function shortLabelForBackground(value: LearnerBackground): string {
  return BACKGROUNDS.find((option) => option.value === value)?.short ?? value;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`;
}
