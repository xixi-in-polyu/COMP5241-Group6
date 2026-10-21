import { describe, expect, it } from "vitest";
import { briefSchema, interactiveLabPayloadSchema, validateInteractiveLab } from "@/lib/assignments/domain";

const entityId = "d8b7df6d-f9c0-4d25-9ec4-527236b47e14";
const evidenceId = "125d48a8-3590-4f20-8b94-c10ab3553be0";
const grounding = { entityIds: [entityId], evidenceRefs: [evidenceId] };
const base = { id: "activity", title: "Practice the concept", instructions: "Complete the activity.", ...grounding };
const pairItems = [{ id: "one", left: "One", right: "First" }, { id: "two", left: "Two", right: "Second" }, { id: "three", left: "Three", right: "Third" }];

const activities = [
  { ...base, type: "flashcards", cards: [{ id: "one", front: "One", back: "First" }, { id: "two", front: "Two", back: "Second" }] },
  { ...base, type: "matching", hint: "Compare the meanings.", explanation: "Each term matches its definition.", pairs: pairItems },
  { ...base, type: "ordering", hint: "Start with the first step.", explanation: "This is the correct sequence.", items: pairItems.map(({ id, left }) => ({ id, label: left })) },
  { ...base, type: "categorization", hint: "Look for shared traits.", explanation: "The items share these traits.", categories: [{ id: "a", label: "Group A" }, { id: "b", label: "Group B" }], items: [{ id: "one", label: "One", categoryId: "a" }, { id: "two", label: "Two", categoryId: "a" }, { id: "three", label: "Three", categoryId: "b" }, { id: "four", label: "Four", categoryId: "b" }] },
  { ...base, type: "timeline", events: pairItems.map(({ id, left, right }) => ({ id, label: left, detail: right })) },
  { ...base, type: "slider_explorer", checkpoints: pairItems.map(({ id, left }, index) => ({ id, value: index, label: left, explanation: `Checkpoint ${index + 1}` })) },
  { ...base, type: "quick_check", questions: [{ id: "question", prompt: "Which option is correct?", options: [{ id: "a", label: "Correct" }, { id: "b", label: "Incorrect" }], correctOptionId: "a", hint: "Review the concept.", explanation: "The first option is supported." }] },
] as const;

describe("Interactive Lab domain", () => {
  it("keeps old briefs compatible with Labs disabled", () => {
    const parsed = briefSchema.parse({ title: "Assessment", instructions: "Check understanding.", count: 2, types: ["short_answer"], difficulty: { easy: 50, medium: 50, hard: 0 }, objectives: ["knowledge"], coverageEntityIds: [] });
    expect(parsed.interactiveLab).toEqual({ enabled: false, instructions: "", componentType: "auto" });
  });

  it.each(activities)("accepts one strict $type activity", (activity) => {
    expect(interactiveLabPayloadSchema.safeParse({ schemaVersion: 1, activity }).success).toBe(true);
  });

  it("rejects multiple activities, unknown fields, unsafe text, and invalid bounds", () => {
    expect(interactiveLabPayloadSchema.safeParse({ schemaVersion: 1, activities }).success).toBe(false);
    expect(interactiveLabPayloadSchema.safeParse({ schemaVersion: 1, activity: { ...activities[0], extra: true } }).success).toBe(false);
    expect(interactiveLabPayloadSchema.safeParse({ schemaVersion: 1, activity: { ...activities[0], title: "Read https://example.com" } }).success).toBe(false);
    expect(interactiveLabPayloadSchema.safeParse({ schemaVersion: 1, activity: { ...activities[0], title: "Use <b>bold</b>" } }).success).toBe(false);
    expect(interactiveLabPayloadSchema.safeParse({ schemaVersion: 1, activity: { ...activities[0], title: "Compute $x+1$" } }).success).toBe(false);
    expect(interactiveLabPayloadSchema.safeParse({ schemaVersion: 1, activity: { ...activities[0], cards: [activities[0].cards[0]] } }).success).toBe(false);
    expect(interactiveLabPayloadSchema.safeParse({ schemaVersion: 1, activity: { ...activities[0], cards: [activities[0].cards[0], activities[0].cards[0]] } }).success).toBe(false);
  });

  it("enforces an explicit type and valid selected evidence", () => {
    const payload = interactiveLabPayloadSchema.parse({ schemaVersion: 1, activity: activities[0] });
    const entity = { id: entityId, name: "Concept", description: "Description", aliases: [], parentId: null, importance: "core" as const, selected: true, evidence: [{ id: evidenceId, segmentId: crypto.randomUUID(), materialId: crypto.randomUUID(), sourceName: "Notes", locator: "p. 1", quote: "Grounding" }] };
    expect(validateInteractiveLab(payload, "auto", [entity])).toEqual([]);
    expect(validateInteractiveLab(payload, "matching", [entity])).toContain("Activity type must be matching.");
    expect(validateInteractiveLab(payload, "auto", [{ ...entity, selected: false }])).toContain(`Unknown or unselected entity: ${entityId}`);
    expect(validateInteractiveLab({ ...payload, activity: { ...payload.activity, evidenceRefs: [crypto.randomUUID()] } }, "auto", [entity])[0]).toMatch(/^Evidence /);
  });
});
