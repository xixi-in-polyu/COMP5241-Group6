import { describe, expect, it } from "vitest";

import { isAiQuotaError } from "@/app/components/ai-settings-link";

describe("AI settings link", () => {
  it.each([
    "AI usage limit reached.",
    "AI hour limit reached.",
    "The provider returned 429 Too Many Requests.",
    "Rate limit exceeded.",
    "insufficient_quota",
  ])("recognizes quota errors: %s", (message) => {
    expect(isAiQuotaError(message)).toBe(true);
  });

  it("does not suggest API settings for unrelated errors", () => {
    expect(isAiQuotaError("The uploaded document could not be parsed.")).toBe(false);
  });
});
