import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertCourseWritesEnabled: vi.fn(),
  requireCourseUser: vi.fn(),
  requireTeacherOwnedCourse: vi.fn(),
  sourceCount: vi.fn(),
  courseUpdateMany: vi.fn(),
  checkAiLimit: vi.fn(),
  startUsageRun: vi.fn(),
  finishUsageRun: vi.fn(),
  startWorkflow: vi.fn(),
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
    apiError(error: unknown) {
      if (error instanceof ApiError) {
        return Response.json({ error: error.message }, { status: error.status });
      }
      return Response.json(
        { error: error instanceof Error ? error.message : "Unexpected server error." },
        { status: 500 },
      );
    },
  };
});
vi.mock("@/lib/courses/auth", () => ({
  assertCourseWritesEnabled: mocks.assertCourseWritesEnabled,
  requireCourseUser: mocks.requireCourseUser,
  requireTeacherOwnedCourse: mocks.requireTeacherOwnedCourse,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    sourceSegment: { count: mocks.sourceCount },
    course: { updateMany: mocks.courseUpdateMany },
  },
}));
vi.mock("@/lib/assignments/usage", () => ({
  checkAiLimit: mocks.checkAiLimit,
  startUsageRun: mocks.startUsageRun,
  finishUsageRun: mocks.finishUsageRun,
}));
vi.mock("workflow/api", () => ({ start: mocks.startWorkflow }));
vi.mock("@/workflows/assignment", () => ({ ingestionWorkflow: vi.fn() }));

import { POST } from "@/app/api/courses/[courseId]/knowledge/rebuild/route";

const request = new Request("http://localhost/api/courses/course-1/knowledge/rebuild", {
  method: "POST",
});
const context = { params: Promise.resolve({ courseId: "course-1" }) };

describe("knowledge rebuild route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCourseUser.mockResolvedValue({ id: "teacher-1", role: "teacher" });
    mocks.requireTeacherOwnedCourse.mockResolvedValue({
      id: "course-1",
      status: "READY",
      phase: "Ready to create assignments",
      error: null,
    });
    mocks.sourceCount.mockResolvedValue(3);
    mocks.courseUpdateMany.mockResolvedValue({ count: 1 });
    mocks.checkAiLimit.mockResolvedValue({ allowed: true });
    mocks.startUsageRun.mockResolvedValue({ id: "usage-1" });
    mocks.finishUsageRun.mockResolvedValue(undefined);
    mocks.startWorkflow.mockResolvedValue({ runId: "workflow-1" });
  });

  it("rejects a rebuild while entity extraction is active", async () => {
    mocks.requireTeacherOwnedCourse.mockResolvedValue({
      id: "course-1",
      status: "EXTRACTING_ENTITIES",
      phase: "Extracting grounded knowledge entities",
      error: null,
    });

    const response = await POST(request, context);

    expect(response.status).toBe(409);
    expect(mocks.courseUpdateMany).not.toHaveBeenCalled();
    expect(mocks.startWorkflow).not.toHaveBeenCalled();
  });

  it("allows only one concurrent request to claim the course", async () => {
    mocks.courseUpdateMany.mockResolvedValueOnce({ count: 0 });

    const response = await POST(request, context);

    expect(response.status).toBe(409);
    expect(mocks.courseUpdateMany).toHaveBeenCalledWith({
      where: { id: "course-1", status: "READY" },
      data: { status: "INGESTING", phase: "Starting knowledge rebuild", error: null },
    });
    expect(mocks.startUsageRun).not.toHaveBeenCalled();
    expect(mocks.startWorkflow).not.toHaveBeenCalled();
  });

  it("claims the course before starting one workflow", async () => {
    const response = await POST(request, context);

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ runId: "workflow-1" });
    expect(mocks.startUsageRun).toHaveBeenCalledTimes(1);
    expect(mocks.startWorkflow).toHaveBeenCalledTimes(1);
  });

  it("restores the previous course state when workflow startup fails", async () => {
    mocks.startWorkflow.mockRejectedValue(new Error("Workflow service unavailable."));

    const response = await POST(request, context);

    expect(response.status).toBe(500);
    expect(mocks.courseUpdateMany).toHaveBeenLastCalledWith({
      where: {
        id: "course-1",
        status: "INGESTING",
        phase: "Starting knowledge rebuild",
      },
      data: {
        status: "READY",
        phase: "Ready to create assignments",
        error: null,
      },
    });
    expect(mocks.finishUsageRun).toHaveBeenCalledWith(
      "usage-1",
      "FAILED",
      "Workflow service unavailable.",
    );
  });
});
