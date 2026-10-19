import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTeacherApi: vi.fn(),
  ownedCourse: vi.fn(),
  ownedAssignment: vi.fn(),
  knowledgeCount: vi.fn(),
  assignmentCreate: vi.fn(),
  assignmentUpdate: vi.fn(),
  assignmentUpdateMany: vi.fn(),
  selectedEntities: vi.fn(),
  startUsageRun: vi.fn(),
  checkAiLimit: vi.fn(),
  isAiConfigured: vi.fn(),
  startWorkflow: vi.fn(),
  resumeEntityHook: vi.fn(),
  assignmentEntityCount: vi.fn(),
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
    ownedCourse: mocks.ownedCourse,
    ownedAssignment: mocks.ownedAssignment,
    apiError(error: unknown) {
      if (error instanceof ApiError) {
        return Response.json({ error: error.message }, { status: error.status });
      }
      if (error && typeof error === "object" && "issues" in error) {
        return Response.json({ error: "Validation failed." }, { status: 422 });
      }
      throw error;
    },
  };
});
vi.mock("@/lib/prisma", () => ({
  prisma: {
    knowledgeEntity: { count: mocks.knowledgeCount },
    assignment: {
      create: mocks.assignmentCreate,
      update: mocks.assignmentUpdate,
      updateMany: mocks.assignmentUpdateMany,
    },
    assignmentKnowledgeEntity: {
      findMany: mocks.selectedEntities,
      count: mocks.assignmentEntityCount,
    },
  },
}));
vi.mock("@/lib/assignments/usage", () => ({
  startUsageRun: mocks.startUsageRun,
  checkAiLimit: mocks.checkAiLimit,
}));
vi.mock("@/lib/assignments/ai", () => ({
  isAiConfigured: mocks.isAiConfigured,
}));
vi.mock("workflow/api", () => ({ start: mocks.startWorkflow }));
vi.mock("@/workflows/assignment", () => ({
  assignmentIngestionWorkflow: vi.fn(),
  generationWorkflow: vi.fn(),
}));
vi.mock("@/workflows/hooks", () => ({
  assignmentEntityReviewHook: { resume: mocks.resumeEntityHook },
}));

import { POST as createAssignment } from "@/app/api/courses/[courseId]/assignments/route";
import { POST as generateAssignment } from "@/app/api/assignments/[assignmentId]/generate/route";
import { POST as confirmKnowledge } from "@/app/api/assignments/[assignmentId]/entities/confirm/route";

const assignmentId = "5a71faef-0c34-45df-9628-431932d71bbc";

describe("staged assignment routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireTeacherApi.mockResolvedValue({ id: "teacher-1" });
    mocks.ownedCourse.mockResolvedValue({ id: "course-1", status: "READY" });
    mocks.ownedAssignment.mockResolvedValue({
      id: assignmentId,
      courseId: "course-1",
      status: "READY_TO_GENERATE",
      entityRevision: 2,
      workflowHookToken: null,
    });
    mocks.knowledgeCount.mockResolvedValue(0);
    mocks.isAiConfigured.mockReturnValue(true);
    mocks.checkAiLimit.mockResolvedValue({ allowed: true });
    mocks.selectedEntities.mockResolvedValue([{ id: "d8b7df6d-f9c0-4d25-9ec4-527236b47e14" }]);
    mocks.assignmentUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("requires a source when a course has no reusable knowledge", async () => {
    const response = await createAssignment(
      new Request("http://localhost/api/courses/course-1/assignments", {
        method: "POST",
        body: JSON.stringify({ title: "New assignment", sources: [] }),
      }),
      { params: Promise.resolve({ courseId: "course-1" }) },
    );

    expect(response.status).toBe(422);
    expect(mocks.assignmentCreate).not.toHaveBeenCalled();
  });

  it("starts ingestion for a valid public YouTube source", async () => {
    mocks.assignmentCreate.mockResolvedValue({ id: assignmentId });
    mocks.startUsageRun.mockResolvedValue({ id: "run-1" });
    mocks.startWorkflow.mockResolvedValue({ runId: "workflow-1" });
    const response = await createAssignment(
      new Request("http://localhost/api/courses/course-1/assignments", {
        method: "POST",
        body: JSON.stringify({
          assignmentId,
          title: "Video assignment",
          sources: [{ kind: "VIDEO", sourceUrl: "https://youtu.be/EJyuu6zlQCg" }],
        }),
      }),
      { params: Promise.resolve({ courseId: "course-1" }) },
    );

    expect(response.status).toBe(202);
    expect(mocks.assignmentCreate).toHaveBeenCalledOnce();
    expect(mocks.startWorkflow).toHaveBeenCalledOnce();
  });

  it("rejects generation outside the Brief phase", async () => {
    mocks.ownedAssignment.mockResolvedValue({
      id: assignmentId,
      courseId: "course-1",
      status: "AWAITING_ENTITY_REVIEW",
    });
    const response = await generateAssignment(
      new Request(`http://localhost/api/assignments/${assignmentId}/generate`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ assignmentId }) },
    );

    expect(response.status).toBe(409);
    expect(mocks.assignmentUpdateMany).not.toHaveBeenCalled();
  });

  it("does not resume entity review with a stale revision", async () => {
    mocks.ownedAssignment.mockResolvedValue({
      id: assignmentId,
      courseId: "course-1",
      status: "AWAITING_ENTITY_REVIEW",
      entityRevision: 2,
      workflowHookToken: `assignment-entity-review:${assignmentId}:2`,
    });
    const response = await confirmKnowledge(
      new Request(`http://localhost/api/assignments/${assignmentId}/entities/confirm`, {
        method: "POST",
        body: JSON.stringify({ revision: 1 }),
      }),
      { params: Promise.resolve({ assignmentId }) },
    );

    expect(response.status).toBe(409);
    expect(mocks.resumeEntityHook).not.toHaveBeenCalled();
  });
});
