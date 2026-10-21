/**
 * Enum translation between the UI's lower-case unions and Prisma's upper-case
 * enum values. Kept dependency-free so both the server code and the unit tests
 * can import it without touching a database client.
 */

export const LEVEL_TO_DB = {
  beginner: "BEGINNER",
  intermediate: "INTERMEDIATE",
  advanced: "ADVANCED",
} as const;

export const BACKGROUND_TO_DB = {
  beginner: "BEGINNER",
  experienced: "EXPERIENCED",
} as const;

export const STATUS_TO_DB = {
  draft: "DRAFT",
  published: "PUBLISHED",
} as const;

export const BLOCK_TYPE_TO_DB = {
  heading: "HEADING",
  text: "TEXT",
  image: "IMAGE",
  video: "VIDEO",
  file: "FILE",
  activity: "ACTIVITY",
  summary: "SUMMARY",
} as const;

export const LEVEL_FROM_DB: Record<string, keyof typeof LEVEL_TO_DB> = {
  BEGINNER: "beginner",
  INTERMEDIATE: "intermediate",
  ADVANCED: "advanced",
};

export const BACKGROUND_FROM_DB: Record<string, keyof typeof BACKGROUND_TO_DB> = {
  BEGINNER: "beginner",
  EXPERIENCED: "experienced",
};

export const STATUS_FROM_DB: Record<string, keyof typeof STATUS_TO_DB> = {
  DRAFT: "draft",
  PUBLISHED: "published",
};

export const BLOCK_TYPE_FROM_DB: Record<string, keyof typeof BLOCK_TYPE_TO_DB> = {
  HEADING: "heading",
  TEXT: "text",
  IMAGE: "image",
  VIDEO: "video",
  FILE: "file",
  ACTIVITY: "activity",
  SUMMARY: "summary",
};
