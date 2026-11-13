import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTeacherApi: vi.fn(),
  ownedAssignment: vi.fn(),
  isAiConfigured: vi.fn(),
  regenerateQuestion: vi.fn(),
  validateGroundedQuestion: vi.fn(),
  loadAssignmentKnowledgeContext: vi.fn(),
  checkAiLimit: vi.fn(),
  startUsageRun: vi.fn(),
  finishUsageRun: vi.fn(),
  questionVersionCreate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    constructor(public readonly status: number, message: string) { super(message); }
  }
  return {
    ApiError,
    requireTeacherApi: mocks.requireTeacherApi,
    ownedAssignment: mocks.ownedAssignment,
    apiError(error: unknown) {
      if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
      throw error;
    },
  };
});
vi.mock("@/lib/assignments/ai", () => ({
  isAiConfigured: mocks.isAiConfigured,
  regenerateQuestion: mocks.regenerateQuestion,
  validateGroundedQuestion: mocks.validateGroundedQuestion,
}));
vi.mock("@/lib/assignments/context", () => ({ loadAssignmentKnowledgeContext: mocks.loadAssignmentKnowledgeContext }));
vi.mock("@/lib/assignments/usage", () => ({
  checkAiLimit: mocks.checkAiLimit,
  startUsageRun: mocks.startUsageRun,
  finishUsageRun: mocks.finishUsageRun,
}));
vi.mock("@/lib/prisma", () => ({ prisma: { questionVersion: { create: mocks.questionVersionCreate } } }));

import { POST } from "@/app/api/assignments/[assignmentId]/questions/[questionId]/candidate/route";

const assignmentId = "5a71faef-0c34-45df-9628-431932d71bbc";
const questionId = "125d48a8-3590-4f20-8b94-c10ab3553be0";
const evidenceId = "f1f607bd-b99b-415b-abf5-058037f34770";
const entityId = "67c690c4-e9b8-44ef-bc61-7a64c0b89781";
const current = {
  id: questionId,
  origin: "ai_generated",
  type: "single_choice",
  objective: "knowledge",
  difficulty: "easy",
  entityIds: [entityId],
  prompt: "What is SDLC?",
  options: ["A lifecycle", "A database"],
  answer: "A",
  explanation: "It is a lifecycle.",
  score: 10,
  evidenceRefs: [evidenceId],
  warnings: [],
};
const regenerated = {
  ...current,
  type: "multi_choice",
  objective: "application",
  difficulty: "medium",
  prompt: "Which two actions apply SDLC practices?",
  options: ["Analyze requirements", "Ignore testing", "Plan deployment"],
  answer: "A,C",
};

describe("question regeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireTeacherApi.mockResolvedValue({ id: "teacher-1" });
    mocks.ownedAssignment.mockResolvedValue({
      id: assignmentId,
      courseId: "course-1",
      status: "DRAFT",
      questions: [current],
      course: { teacherId: "teacher-1" },
    });
    mocks.isAiConfigured.mockReturnValue(true);
    mocks.checkAiLimit.mockResolvedValue({ allowed: true });
    mocks.loadAssignmentKnowledgeContext.mockResolvedValue({ entities: [], segments: [] });
    mocks.startUsageRun.mockResolvedValue({ id: "run-1" });
    mocks.finishUsageRun.mockResolvedValue(undefined);
    mocks.regenerateQuestion.mockResolvedValue(regenerated);
    mocks.validateGroundedQuestion.mockReturnValueOnce(["Options must be unique."]).mockReturnValueOnce([]);
    mocks.questionVersionCreate.mockResolvedValue({ id: "version-1" });
  });

  it("retries a rejected candidate and validates explicit property changes", async () => {
    const response = await POST(
      new Request(`http://localhost/api/assignments/${assignmentId}/questions/${questionId}/candidate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instruction: "Change this into a medium multi-choice application question." }),
      }),
      { params: Promise.resolve({ assignmentId, questionId }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.regenerateQuestion).toHaveBeenCalledTimes(2);
    expect(mocks.regenerateQuestion.mock.calls[1][5]).toEqual(["Options must be unique."]);
    expect(mocks.validateGroundedQuestion).toHaveBeenLastCalledWith(
      regenerated,
      expect.objectContaining({ type: "multi_choice", objective: "application", difficulty: "medium" }),
      [],
      [],
    );
    expect(mocks.questionVersionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ payload: regenerated }),
    }));
    expect(mocks.finishUsageRun).toHaveBeenCalledWith("run-1", "SUCCESS");
  });
});
