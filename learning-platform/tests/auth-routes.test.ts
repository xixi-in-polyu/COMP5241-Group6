import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  updateUser: vi.fn(),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: mocks.findFirst, update: mocks.updateUser },
  },
}));
vi.mock("@/lib/auth/session", () => ({
  createSession: mocks.createSession,
  deleteSession: mocks.deleteSession,
}));

import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";

describe("authentication routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue({
      id: "student-1",
      role: "student",
      password: "password",
    });
  });

  it("creates a session after successful login", async () => {
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
          role: "student",
        },
        select: { id: true, role: true, password: true },
      }),
    );
    expect(mocks.createSession).toHaveBeenCalledWith("student-1");
    expect(mocks.updateUser).toHaveBeenCalledOnce();
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
    expect(mocks.deleteSession).toHaveBeenCalledOnce();
  });

  it("rejects an incorrect password and invalidates any existing session", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "student-1",
      role: "student",
      password: "different-password",
    });

    const response = await login(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "student@example.com",
          password: "wrong-password",
          role: "student",
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.createSession).not.toHaveBeenCalled();
    expect(mocks.deleteSession).toHaveBeenCalledOnce();
  });

  it("rejects the removed admin role at login", async () => {
    const response = await login(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "admin@example.com",
          password: "password",
          role: "admin",
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
    expect(mocks.deleteSession).not.toHaveBeenCalled();
  });

  it("invalidates the session on logout", async () => {
    const response = await logout();

    expect(response.status).toBe(200);
    expect(mocks.deleteSession).toHaveBeenCalledOnce();
  });
});
