import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorizeApiRole: vi.fn(), assignmentFindFirst: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/authorization", () => ({ authorizeApiRole: mocks.authorizeApiRole }));
vi.mock("@/lib/prisma", () => ({ prisma: { assignment: { findFirst: mocks.assignmentFindFirst } } }));

import { GET } from "@/app/api/student/assignments/[assignmentId]/interactive-labs/route";

const entityId = "d8b7df6d-f9c0-4d25-9ec4-527236b47e14";
const evidenceId = "125d48a8-3590-4f20-8b94-c10ab3553be0";
const payload = { schemaVersion: 1, activity: { type: "flashcards", id: "activity", title: "Review", instructions: "Review every card.", entityIds: [entityId], evidenceRefs: [evidenceId], cards: [{ id: "one", front: "One", back: "First" }, { id: "two", front: "Two", back: "Second" }] } };

describe("student Interactive Lab API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizeApiRole.mockResolvedValue({ response: null, user: { id: "student-1" } });
    mocks.assignmentFindFirst.mockResolvedValue({ id: "assignment-1", title: "Practice", course: { id: "course-1", title: "Course" }, interactiveLabs: [{ id: "lab-1", ordinal: 0, activeVersionId: "version-1", approvedVersionId: "version-1", versions: [{ id: "version-1", sequence: 1, actualType: "flashcards", payload }] }] });
  });

  it("returns only an approved active version without grounding or teacher metadata", async () => {
    const response = await GET(new Request("http://localhost/api/student/assignments/assignment-1/interactive-labs"), { params: Promise.resolve({ assignmentId: "assignment-1" }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.labs).toHaveLength(1);
    expect(body.labs[0].payload.activity).not.toHaveProperty("evidenceRefs");
    expect(body.labs[0].payload.activity).not.toHaveProperty("entityIds");
    expect(body.labs[0]).not.toHaveProperty("instruction");
    expect(body.labs[0]).not.toHaveProperty("versions");
  });

  it("does not expose an unapproved Lab", async () => {
    mocks.assignmentFindFirst.mockResolvedValue({ id: "assignment-1", title: "Practice", course: { id: "course-1", title: "Course" }, interactiveLabs: [{ id: "lab-1", ordinal: 0, activeVersionId: "version-2", approvedVersionId: "version-1", versions: [{ id: "version-2", sequence: 2, actualType: "flashcards", payload }] }] });
    const response = await GET(new Request("http://localhost/api/student/assignments/assignment-1/interactive-labs"), { params: Promise.resolve({ assignmentId: "assignment-1" }) });
    expect(response.status).toBe(404);
  });
});
