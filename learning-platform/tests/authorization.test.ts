import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: mocks.getAuthenticatedUser,
}));

import { authorizeApiRole } from "@/lib/auth/authorization";

describe("API role authorization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no session exists", async () => {
    mocks.getAuthenticatedUser.mockResolvedValue(null);

    const result = await authorizeApiRole("student");

    expect(result.response?.status).toBe(401);
  });

  it("returns 403 when an authenticated role is not allowed", async () => {
    mocks.getAuthenticatedUser.mockResolvedValue({
      id: "teacher-1",
      email: "teacher@example.com",
      role: "teacher",
    });

    const result = await authorizeApiRole("student");

    expect(result.response?.status).toBe(403);
  });

  it("allows a matching role", async () => {
    const user = {
      id: "student-1",
      email: "student@example.com",
      role: "student",
    } as const;
    mocks.getAuthenticatedUser.mockResolvedValue(user);

    await expect(authorizeApiRole("student")).resolves.toEqual({
      response: null,
      user,
    });
  });
});
