import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTeacherApi: vi.fn(),
  ownedAssignment: vi.fn(),
  assignmentUpdateMany: vi.fn(),
  interactiveLabFindMany: vi.fn(),
  entityFindMany: vi.fn(),
  leaseDeleteMany: vi.fn(),
  leaseCreate: vi.fn(),
  checkAiLimit: vi.fn(),
  startUsageRun: vi.fn(),
  isAiConfigured: vi.fn(),
  startWorkflow: vi.fn(),
  loadAssignmentKnowledgeContext: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    constructor(public readonly status: number, message: string) {
      super(message);
    }
  }

  return {
    ApiError,
    requireTeacherApi: mocks.requireTeacherApi,
    ownedAssignment: mocks.ownedAssignment,
    apiError(error: unknown) {
      if (error instanceof ApiError) {
        return Response.json({ error: error.message }, { status: error.status });
      }
      throw error;
    },
  };
});
vi.mock("@/lib/prisma", () => ({
  prisma: {
    assignment: { updateMany: mocks.assignmentUpdateMany },
    interactiveLab: { findMany: mocks.interactiveLabFindMany },
    knowledgeEntity: { findMany: mocks.entityFindMany },
    assignmentSlotLease: {
      deleteMany: mocks.leaseDeleteMany,
      create: mocks.leaseCreate,
    },
  },
}));
vi.mock("@/lib/assignments/ai", () => ({
  isAiConfigured: mocks.isAiConfigured,
}));
vi.mock("@/lib/assignments/context", () => ({
  loadAssignmentKnowledgeContext: mocks.loadAssignmentKnowledgeContext,
}));
vi.mock("@/lib/assignments/usage", () => ({
  checkAiLimit: mocks.checkAiLimit,
  startUsageRun: mocks.startUsageRun,
}));
vi.mock("workflow/api", () => ({ start: mocks.startWorkflow }));
vi.mock("@/workflows/assignment", () => ({ retryFailedSlot: vi.fn() }));

import { PUT as saveAssignment } from "@/app/api/assignments/[assignmentId]/route";
import { POST as submitAssignment } from "@/app/api/assignments/[assignmentId]/submit/route";
import { POST as retrySlot } from "@/app/api/assignments/[assignmentId]/slots/[slotIndex]/retry/route";

const assignmentId = "5a71faef-0c34-45df-9628-431932d71bbc";
const entityId = "d8b7df6d-f9c0-4d25-9ec4-527236b47e14";
const question = {
  id: "125d48a8-3590-4f20-8b94-c10ab3553be0",
  origin: "teacher_authored",
  type: "short_answer",
  objective: "knowledge",
  difficulty: "easy",
  entityIds: [],
  prompt: "Explain the interaction principle.",
  options: [],
  answer: "A grounded answer.",
  explanation: "A teacher-authored explanation.",
  score: 10,
  evidenceRefs: [],
  warnings: [],
};

function assignment(overrides: Record<string, unknown> = {}) {
  return {
    id: assignmentId,
    courseId: "course-1",
    status: "DRAFT",
    version: 3,
    questions: [question],
    failedSlots: [],
    course: { id: "course-1", teacherId: "teacher-1" },
    ...overrides,
  };
}

describe("assignment route guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireTeacherApi.mockResolvedValue({ id: "teacher-1" });
    mocks.ownedAssignment.mockResolvedValue(assignment());
    mocks.entityFindMany.mockResolvedValue([]);
    mocks.assignmentUpdateMany.mockResolvedValue({ count: 1 });
    mocks.interactiveLabFindMany.mockResolvedValue([]);
    mocks.isAiConfigured.mockReturnValue(true);
    mocks.checkAiLimit.mockResolvedValue({ allowed: true });
    mocks.loadAssignmentKnowledgeContext.mockResolvedValue({
      entities: [],
      segments: [],
    });
  });

  it("returns 409 when an optimistic draft save loses the version race", async () => {
    mocks.assignmentUpdateMany.mockResolvedValue({ count: 0 });
    const response = await saveAssignment(
      new Request(`http://localhost/api/assignments/${assignmentId}`, {
        method: "PUT",
        body: JSON.stringify({ version: 2, questions: [question] }),
      }),
      { params: Promise.resolve({ assignmentId }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Draft changed in another session. Refresh before saving.",
    });
  });

  it("locks saving after submission", async () => {
    mocks.ownedAssignment.mockResolvedValue(assignment({ status: "SUBMITTED" }));
    const response = await saveAssignment(
      new Request(`http://localhost/api/assignments/${assignmentId}`, {
        method: "PUT",
        body: JSON.stringify({ version: 3, questions: [question] }),
      }),
      { params: Promise.resolve({ assignmentId }) },
    );

    expect(response.status).toBe(409);
    expect(mocks.assignmentUpdateMany).not.toHaveBeenCalled();
  });

  it("blocks submission while a failed slot remains", async () => {
    mocks.ownedAssignment.mockResolvedValue(assignment({
      failedSlots: [{
        index: 0,
        type: "short_answer",
        objective: "knowledge",
        difficulty: "easy",
        entityIds: [entityId],
        score: 10,
        reason: "Provider error",
      }],
    }));
    const response = await submitAssignment(
      new Request(`http://localhost/api/assignments/${assignmentId}/submit`, {
        method: "POST",
        body: JSON.stringify({ version: 3 }),
      }),
      { params: Promise.resolve({ assignmentId }) },
    );

    expect(response.status).toBe(422);
    expect(mocks.assignmentUpdateMany).not.toHaveBeenCalled();
  });

  it("blocks submission while an active Lab has no approved current version", async () => {
    mocks.interactiveLabFindMany.mockResolvedValue([{ generationStatus: "FAILED", activeVersionId: null, approvedVersionId: null }]);
    const response = await submitAssignment(
      new Request(`http://localhost/api/assignments/${assignmentId}/submit`, { method: "POST", body: JSON.stringify({ version: 3 }) }),
      { params: Promise.resolve({ assignmentId }) },
    );
    expect(response.status).toBe(422);
    expect(mocks.assignmentUpdateMany).not.toHaveBeenCalled();
  });

  it("blocks submission while an active Lab version is unapproved", async () => {
    mocks.interactiveLabFindMany.mockResolvedValue([{ generationStatus: "IDLE", activeVersionId: "version-2", approvedVersionId: "version-1" }]);
    const response = await submitAssignment(
      new Request(`http://localhost/api/assignments/${assignmentId}/submit`, { method: "POST", body: JSON.stringify({ version: 3 }) }),
      { params: Promise.resolve({ assignmentId }) },
    );
    expect(response.status).toBe(422);
    expect(mocks.assignmentUpdateMany).not.toHaveBeenCalled();
  });

  it("returns a retry window without acquiring a slot lease when rate limited", async () => {
    mocks.ownedAssignment.mockResolvedValue(assignment({
      failedSlots: [{
        index: 4,
        type: "short_answer",
        objective: "knowledge",
        difficulty: "easy",
        entityIds: [entityId],
        score: 10,
        reason: "Provider error",
      }],
    }));
    mocks.checkAiLimit.mockResolvedValue({ allowed: false, retryAfter: 3600 });

    const response = await retrySlot(
      new Request(`http://localhost/api/assignments/${assignmentId}/slots/4/retry`, { method: "POST" }),
      { params: Promise.resolve({ assignmentId, slotIndex: "4" }) },
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("3600");
    expect(mocks.leaseCreate).not.toHaveBeenCalled();
    expect(mocks.startWorkflow).not.toHaveBeenCalled();
  });
});
