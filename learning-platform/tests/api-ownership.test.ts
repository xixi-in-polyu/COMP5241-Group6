import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeApiRole: vi.fn(),
  findCourse: vi.fn(),
  findAssignment: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/authorization", () => ({
  authorizeApiRole: mocks.authorizeApiRole,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    course: { findUnique: mocks.findCourse },
    assignment: { findUnique: mocks.findAssignment },
  },
}));

import { ApiError, ownedAssignment, ownedCourse } from "@/lib/api";

describe("teacher resource ownership", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a course owned by another teacher", async () => {
    mocks.findCourse.mockResolvedValue({ id: "course-1", teacherId: "teacher-2" });

    await expect(ownedCourse("course-1", "teacher-1")).rejects.toMatchObject({
      status: 403,
      message: "You do not have access to this course.",
    } satisfies Partial<ApiError>);
  });

  it("does not reveal a missing assignment as an authorization failure", async () => {
    mocks.findAssignment.mockResolvedValue(null);

    await expect(ownedAssignment("missing", "teacher-1")).rejects.toMatchObject({
      status: 404,
      message: "Assignment not found.",
    } satisfies Partial<ApiError>);
  });
});
