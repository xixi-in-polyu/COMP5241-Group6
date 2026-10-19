import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findFirst: mocks.findFirst } },
}));
vi.mock("@/lib/auth/session", () => ({
  createSession: mocks.createSession,
  deleteSession: mocks.deleteSession,
}));

import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";

describe("authentication routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a session after successful login", async () => {
    mocks.findFirst.mockResolvedValue({ id: "student-1", role: "student" });

    const response = await login(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: " Student@Example.com ",
          password: "password",
          role: "student",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          email: {
            equals: "student@example.com",
            mode: "insensitive",
          },
          password: "password",
          role: "student",
        },
      }),
    );
    expect(mocks.createSession).toHaveBeenCalledWith("student-1");
  });

  it("does not create a session for invalid credentials", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const response = await login(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "missing@example.com",
          password: "wrong",
          role: "student",
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("invalidates the session on logout", async () => {
    const response = await logout();

    expect(response.status).toBe(200);
    expect(mocks.deleteSession).toHaveBeenCalledOnce();
  });
});
