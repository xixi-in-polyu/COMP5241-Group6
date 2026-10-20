import { describe, expect, it } from "vitest";
import type { KnowledgeEntity } from "@/lib/assignments/domain";
import {
  getAssignmentSourceReadiness,
  mergeAssignmentEntities,
  snapshotCourseEntities,
  validateAssignmentSourceSelection,
} from "@/lib/assignments/staged";

const courseEntityId = "d8b7df6d-f9c0-4d25-9ec4-527236b47e14";
const segmentId = "125d48a8-3590-4f20-8b94-c10ab3553be0";
const materialId = "5a71faef-0c34-45df-9628-431932d71bbc";

function entity(overrides: Partial<KnowledgeEntity> = {}): KnowledgeEntity {
  return {
    id: courseEntityId,
    name: "Usability",
    description: "The quality of use.",
    aliases: ["ease of use"],
    parentId: null,
    importance: "supporting",
    selected: true,
    evidence: [{
      id: "6c6fdf3c-e733-4727-b827-197a18345c9b",
      segmentId,
      materialId,
      sourceName: "Course notes",
      locator: "Paragraph 1",
      quote: "Usability supports effective interaction.",
    }],
    ...overrides,
  };
}

describe("assignment knowledge snapshots", () => {
  it("copies course entities with new IDs and remapped parents", () => {
    const childId = "08e082fe-1b91-46cf-a038-894510e25a39";
    const ids = [
      "e6252745-7daa-4798-ae3c-8f289178bb15",
      "388f1564-63fa-465b-9276-85b369a3ace7",
    ];
    const snapshots = snapshotCourseEntities([
      entity(),
      entity({ id: childId, name: "Efficiency", parentId: courseEntityId }),
    ], () => ids.shift()!);

    expect(snapshots[0].sourceCourseEntityId).toBe(courseEntityId);
    expect(snapshots[1].parentId).toBe(snapshots[0].id);
    expect(snapshots[1].sourceCourseEntityId).toBe(childId);
  });

  it("merges matching extracted concepts without duplicating evidence", () => {
    const [snapshot] = snapshotCourseEntities([entity()], () =>
      "e6252745-7daa-4798-ae3c-8f289178bb15",
    );
    const merged = mergeAssignmentEntities([snapshot], [
      entity({
        id: "388f1564-63fa-465b-9276-85b369a3ace7",
        name: " usability ",
        importance: "core",
        aliases: ["Ease of use", "learnability"],
      }),
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0].importance).toBe("core");
    expect(merged[0].aliases).toEqual(["ease of use", "learnability"]);
    expect(merged[0].evidence).toHaveLength(1);
  });
});

describe("assignment source workflow", () => {
  it("allows either two documents or one video, but never both", () => {
    expect(() => validateAssignmentSourceSelection([
      { kind: "FILE", status: "UPLOADED", size: 1 },
      { kind: "TRANSCRIPT", status: "UPLOADED", size: 1 },
    ])).not.toThrow();
    expect(() => validateAssignmentSourceSelection([
      { kind: "FILE", status: "UPLOADED", size: 1 },
      { kind: "VIDEO", status: "UPLOADED" },
    ])).toThrow(/not both/);
  });

  it("requires a source only when the course has no reusable knowledge", () => {
    expect(getAssignmentSourceReadiness([], true)).toBe("ready");
    expect(getAssignmentSourceReadiness([], false)).toBe("fix");
    expect(getAssignmentSourceReadiness([
      { kind: "VIDEO", status: "NEEDS_INPUT" },
    ], true)).toBe("fix");
    expect(getAssignmentSourceReadiness([
      { kind: "FILE", status: "PARSING", size: 10 },
    ], false)).toBe("processing");
  });
});
