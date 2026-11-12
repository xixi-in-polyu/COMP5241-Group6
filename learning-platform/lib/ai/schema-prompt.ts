import { z } from "zod";

/**
 * Renders a Zod schema as the instruction block that goes into a chat prompt.
 *
 * Two things about the JSON that `z.toJSONSchema()` produces make Zhipu's free
 * GLM models fail, both observed repeatedly:
 *
 * - `$schema` (a dialect declaration) and `additionalProperties` read as "you
 *   are being asked to write a schema document", so the model echoes the schema
 *   instead of returning an instance; nested schemas fail every time.
 * - Presented as "return JSON matching this schema", the same text is enough of
 *   an invitation that the model still copies it, or wraps its answer in prose.
 *
 * So the type noise is stripped and the block states explicitly that the JSON is
 * a definition to conform to, not content to reproduce. With both changes the
 * nested chapter schema went from 2/2 schema echoes to 2/2 valid instances.
 */
function stripTypeNoise(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripTypeNoise);
  if (!node || typeof node !== "object") return node;
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === "$schema" || key === "additionalProperties") continue;
    copy[key] = stripTypeNoise(value);
  }
  return copy;
}

export function promptSchema(schema: z.ZodType): string {
  const shape = stripTypeNoise(z.toJSONSchema(schema));
  return `The JSON below is a type definition, not the answer: do not repeat or describe it.
Return one JSON object that conforms to it and contains every field listed in "required". Copy every "enum" value exactly as written, in its original English form; do not translate enum values, only free-text fields.
Type definition: ${JSON.stringify(shape)}`;
}
