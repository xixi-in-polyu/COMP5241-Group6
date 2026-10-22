import { z } from "zod";

export const resourceInputSchema = z.object({
  id: z.string().max(64).optional(),
  kind: z.enum(["link", "video", "file"]),
  title: z.string().max(200).default(""),
  url: z.string().trim().min(1).max(2_000),
});

const textBlock = (type: "heading" | "text" | "summary", max: number) =>
  z.object({ id: z.string().max(64).optional(), type: z.literal(type), text: z.string().max(max) });

export const blockInputSchema = z.discriminatedUnion("type", [
  textBlock("heading", 400),
  textBlock("text", 8_000),
  textBlock("summary", 2_000),
  z.object({
    id: z.string().max(64).optional(),
    type: z.literal("image"),
    url: z.string().max(2_000).default(""),
    caption: z.string().max(400).default(""),
  }),
  z.object({
    id: z.string().max(64).optional(),
    type: z.literal("video"),
    url: z.string().max(2_000).default(""),
    title: z.string().max(200).default(""),
  }),
  z.object({
    id: z.string().max(64).optional(),
    type: z.literal("file"),
    url: z.string().max(2_000).default(""),
    title: z.string().max(200).default(""),
    description: z.string().max(800).default(""),
  }),
  z.object({
    id: z.string().max(64).optional(),
    type: z.literal("activity"),
    instruction: z.string().max(800).default(""),
    items: z
      .array(z.object({ id: z.string().max(64).optional(), text: z.string().max(300) }))
      .max(20)
      .default([]),
  }),
]);

export const chapterInputSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  objectives: z.array(z.string().max(300)).max(20).default([]),
  resources: z.array(resourceInputSchema).max(20).default([]),
  blocks: z.array(blockInputSchema).max(60).default([]),
});

export const courseCreateSchema = z.object({
  title: z.string().trim().min(1).max(200).default("Untitled course"),
  description: z.string().max(2_000).default(""),
  subject: z.string().max(200).default(""),
  audience: z.string().max(400).default(""),
  objectives: z.array(z.string().max(300)).max(20).default([]),
  level: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
  background: z.enum(["beginner", "experienced"]).default("experienced"),
  durationMinutes: z.number().int().min(5).max(600).default(30),
  language: z.enum(["en", "zh"]).default("en"),
  resources: z.array(resourceInputSchema).max(20).default([]),
  chapters: z.array(chapterInputSchema).max(20).default([]),
  pastedNotes: z.string().max(200_000).optional(),
});

export const coursePatchSchema = courseCreateSchema.partial();

export const aiSelectionSchema = z.object({
  materialIds: z.array(z.string().uuid()).max(8),
});

export function hasPublishableContent(chapters: z.infer<typeof chapterInputSchema>[]) {
  return chapters.some((chapter) =>
    chapter.blocks.some((block) => {
      if ("text" in block) {
        return block.text.trim().length > 0;
      }
      if (block.type === "activity") {
        return block.instruction.trim().length > 0 || block.items.some((item) => item.text.trim());
      }
      return "url" in block && Boolean(block.url.trim());
    }),
  );
}
