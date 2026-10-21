import { z } from "zod";

import type { MiniCourseBlock } from "./types";
import { BLOCK_TYPE_TO_DB } from "./db-enums";

/**
 * Request validation for the mini-course API.
 *
 * The client sends the same shapes the UI works with; these schemas are the only
 * place that decides what is allowed in, and the helpers below turn a block list
 * into rows for Prisma.
 */

const resourceSchema = z.object({
  id: z.string().max(64).optional(),
  kind: z.enum(["link", "video", "file"]),
  title: z.string().max(200).default(""),
  url: z.string().max(2000).default(""),
});

const headingSchema = z.object({ id: z.string().max(64).optional(), type: z.literal("heading"), text: z.string().max(400) });
const textSchema = z.object({ id: z.string().max(64).optional(), type: z.literal("text"), text: z.string().max(8000) });
const summarySchema = z.object({ id: z.string().max(64).optional(), type: z.literal("summary"), text: z.string().max(2000) });
const imageSchema = z.object({
  id: z.string().max(64).optional(),
  type: z.literal("image"),
  url: z.string().max(2000).default(""),
  caption: z.string().max(400).default(""),
});
const videoSchema = z.object({
  id: z.string().max(64).optional(),
  type: z.literal("video"),
  url: z.string().max(2000).default(""),
  title: z.string().max(200).default(""),
});
const fileSchema = z.object({
  id: z.string().max(64).optional(),
  type: z.literal("file"),
  url: z.string().max(2000).default(""),
  title: z.string().max(200).default(""),
  description: z.string().max(800).default(""),
});
const activitySchema = z.object({
  id: z.string().max(64).optional(),
  type: z.literal("activity"),
  instruction: z.string().max(800).default(""),
  items: z
    .array(z.object({ id: z.string().max(64).optional(), text: z.string().max(300) }))
    .max(20)
    .default([]),
});

export const blockSchema = z.discriminatedUnion("type", [
  headingSchema,
  textSchema,
  summarySchema,
  imageSchema,
  videoSchema,
  fileSchema,
  activitySchema,
]);

export const chapterSchema = z.object({
  title: z.string().trim().min(1).max(200),
  objectives: z.array(z.string().max(300)).max(20).default([]),
  resources: z.array(resourceSchema).max(20).default([]),
  blocks: z.array(blockSchema).max(60).default([]),
});

export const courseInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().max(2000).default(""),
  subject: z.string().max(200).default(""),
  audience: z.string().max(400).default(""),
  objectives: z.array(z.string().max(300)).max(20).default([]),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  background: z.enum(["beginner", "experienced"]),
  durationMinutes: z.number().int().min(5).max(600),
  language: z.enum(["en", "zh"]),
  resources: z.array(resourceSchema).max(20).default([]),
  chapters: z.array(chapterSchema).max(20).default([]),
});

export const coursePatchSchema = courseInputSchema.partial().extend({
  status: z.enum(["draft", "published"]).optional(),
});

export type CourseInput = z.infer<typeof courseInputSchema>;
export type CoursePatch = z.infer<typeof coursePatchSchema>;

/** Everything on a block except its identity and kind becomes the JSON payload. */
export function blockPayload(block: MiniCourseBlock): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...block };
  delete payload.id;
  delete payload.type;
  return payload;
}

export function blocksToCreate(blocks: MiniCourseBlock[]) {
  return blocks.map((block, index) => ({
    ordinal: index + 1,
    type: BLOCK_TYPE_TO_DB[block.type],
    payload: blockPayload(block),
  }));
}
