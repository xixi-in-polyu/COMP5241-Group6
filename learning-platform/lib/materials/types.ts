import type { z } from "zod";
import type { locatorSchema } from "@/lib/assignments/domain";

export type Locator = z.infer<typeof locatorSchema>;
export type SourceUnit = { locator: Locator; text: string };
export type ParsedMaterial = {
  units: SourceUnit[];
  pageCount?: number;
};

export class MaterialError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "MaterialError";
  }
}
