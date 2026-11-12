import { describe, expect, it } from "vitest";
import { z } from "zod";

import { promptSchema } from "@/lib/ai/schema-prompt";

describe("structured-output fallback prompt", () => {
  it("includes a concrete JSON example without schema dialect noise", () => {
    const prompt = promptSchema(z.object({
      title: z.string().min(3),
      level: z.enum(["beginner", "advanced"]),
      sections: z.array(z.object({ heading: z.string(), body: z.string() })).min(1),
    }));

    expect(prompt).toContain("Example output shape:");
    expect(prompt).toContain('"level":"beginner"');
    expect(prompt).toContain('"sections":[{');
    expect(prompt).not.toContain('"$schema"');
    expect(prompt).not.toContain('"additionalProperties"');
  });
});
