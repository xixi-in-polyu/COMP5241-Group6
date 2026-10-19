import { describe, expect, it } from "vitest";
import { briefSchema, createQuestionSlots, questionSchema, validateDraft } from "@/lib/assignments/domain";

const brief = briefSchema.parse({
  title: "Grounded assessment",
  instructions: "Assess practical understanding.",
  count: 7,
  types: ["single_choice", "short_answer"],
  difficulty: { easy: 30, medium: 50, hard: 20 },
  objectives: ["knowledge", "application"],
  coverageEntityIds: [],
});

describe("assignment domain", () => {
  it("assigns slots deterministically and preserves the requested count", () => {
    const first = createQuestionSlots(brief, ["d8b7df6d-f9c0-4d25-9ec4-527236b47e14", "125d48a8-3590-4f20-8b94-c10ab3553be0"]);
    expect(first).toEqual(createQuestionSlots(brief, ["d8b7df6d-f9c0-4d25-9ec4-527236b47e14", "125d48a8-3590-4f20-8b94-c10ab3553be0"]));
    expect(first).toHaveLength(7);
    expect(first.map((slot) => slot.type)).toEqual(["single_choice", "short_answer", "single_choice", "short_answer", "single_choice", "short_answer", "single_choice"]);
    expect(first.filter((slot) => slot.difficulty === "easy")).toHaveLength(2);
    expect(first.filter((slot) => slot.difficulty === "medium")).toHaveLength(4);
    expect(first.filter((slot) => slot.difficulty === "hard")).toHaveLength(1);
  });

  it("requires evidence for AI questions but not teacher-authored questions", () => {
    const base = { id: crypto.randomUUID(), type: "short_answer", objective: "knowledge", difficulty: "easy", entityIds: [], prompt: "Explain the principle.", options: [], answer: "An answer", explanation: "An explanation", score: 10, evidenceRefs: [], warnings: [] } as const;
    expect(questionSchema.safeParse({ ...base, origin: "ai_generated" }).success).toBe(false);
    expect(questionSchema.safeParse({ ...base, origin: "teacher_authored" }).success).toBe(true);
  });

  it("blocks save while a failed slot remains", () => {
    const result = validateDraft([], [{ index: 0, type: "short_answer", objective: "knowledge", difficulty: "easy", entityIds: [crypto.randomUUID()], score: 10, reason: "Provider error" }]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Resolve or delete every failed slot before saving.");
  });

  it("rejects invalid choice answers and open questions with options", () => {
    const base = { id: crypto.randomUUID(), origin: "teacher_authored", objective: "knowledge", difficulty: "easy", entityIds: [], prompt: "Question", answer: "A", explanation: "Explanation", score: 10, evidenceRefs: [], warnings: [] } as const;
    expect(questionSchema.safeParse({ ...base, type: "single_choice", options: ["Only one"] }).success).toBe(false);
    expect(questionSchema.safeParse({ ...base, type: "short_answer", options: ["Not allowed"] }).success).toBe(false);
  });
});
