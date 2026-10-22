/**
 * Shared shapes for Mini-courses.
 *
 * These mirror the Prisma models added in the next change: a course owns
 * chapters, and each chapter owns ordered content blocks. A block keeps its
 * payload in one discriminated union instead of one table per block kind, so
 * the editor and the reader can render any block from the same list.
 */

export type MiniCourseRole = "teacher" | "student";

export type MiniCourseStatus = "draft" | "published";

export type MiniCourseLevel = "beginner" | "intermediate" | "advanced";

/**
 * What the material assumes the reader already knows. This is deliberately
 * separate from the level: a course can be demanding yet need no prior coding
 * experience, or be light while assuming the reader already ships code.
 */
export type LearnerBackground = "beginner" | "experienced";

export type MiniCourseLanguage = "en" | "zh";

export type BlockType =
  | "heading"
  | "text"
  | "image"
  | "video"
  | "file"
  | "activity"
  | "summary";

/** A file the author uploaded; the bytes live in object storage. */
export interface MediaRef {
  id: string;
  name: string;
  mimeType: string;
  size: number;
}

export type ResourceKind = "link" | "video" | "file";

/** A material attached to the course or to a single chapter. */
export interface MiniCourseResource {
  id: string;
  kind: ResourceKind;
  title: string;
  url: string;
  media?: MediaRef;
}

export interface HeadingBlock {
  id: string;
  type: "heading";
  text: string;
}

export interface TextBlock {
  id: string;
  type: "text";
  text: string;
}

export interface ImageBlock {
  id: string;
  type: "image";
  url: string;
  caption: string;
  media?: MediaRef;
}

export interface VideoBlock {
  id: string;
  type: "video";
  url: string;
  title: string;
  media?: MediaRef;
}

export interface FileBlock {
  id: string;
  type: "file";
  url: string;
  title: string;
  description: string;
  media?: MediaRef;
}

/** Ordering activity: the learner arranges the items into the authored order. */
export interface ActivityBlock {
  id: string;
  type: "activity";
  instruction: string;
  items: { id: string; text: string }[];
}

export interface SummaryBlock {
  id: string;
  type: "summary";
  text: string;
}

export type MiniCourseBlock =
  | HeadingBlock
  | TextBlock
  | ImageBlock
  | VideoBlock
  | FileBlock
  | ActivityBlock
  | SummaryBlock;

export interface MiniCourseChapter {
  id: string;
  title: string;
  objectives: string[];
  resources: MiniCourseResource[];
  blocks: MiniCourseBlock[];
}

export interface MiniCourse {
  id: string;
  title: string;
  summary: string;
  audience: string;
  objectives: string[];
  subject: string;
  level: MiniCourseLevel;
  background: LearnerBackground;
  durationMinutes: number;
  language: MiniCourseLanguage;
  status: MiniCourseStatus;
  ownerId: string;
  ownerRole: MiniCourseRole;
  createdAt: string;
  updatedAt: string;
  resources: MiniCourseResource[];
  chapters: MiniCourseChapter[];
}
