import { describe, expect, it } from "vitest";

import { isNoIssuesFoundWarning, visibleQualityWarnings } from "@/lib/assignments/quality-warnings";

describe("quality warnings", () => {
  it("recognizes empty review messages with or without a question prefix", () => {
    expect(isNoIssuesFoundWarning("No issues found.")).toBe(true);
    expect(isNoIssuesFoundWarning("550e8400-e29b-41d4-a716-446655440000: No issues found.")).toBe(true);
    expect(isNoIssuesFoundWarning("4588d644-7d1a-4b33-8f36-669cc13c2b2b: The answer is supported by evidence and matches the easy difficulty level. No issues found.")).toBe(true);
    expect(isNoIssuesFoundWarning("No issues found with grounding, but the difficulty is mislabeled.")).toBe(false);
  });

  it("removes empty review messages while preserving real warnings", () => {
    expect(visibleQualityWarnings([
      "No issues found.",
      "550e8400-e29b-41d4-a716-446655440000: No issues found.",
      "The answer is correct and well-supported. No issues found.",
      "The answer is not grounded in the cited evidence.",
    ])).toEqual(["The answer is not grounded in the cited evidence."]);
  });
});
