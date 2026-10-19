import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  createUser: vi.fn(),
  createSession: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: mocks.findFirst,
      create: mocks.createUser,
    },
  },
}));
vi.mock("@/lib/auth/session", () => ({
  createSession: mocks.createSession,
}));

import { POST as login } from "@/app/api/auth/login/route";
import { POST as register } from "@/app/api/auth/register/route";
import { verifyPassword } from "@/lib/auth/password";
import { createRegistrationRateLimiter } from "@/lib/auth/registration";

let requestNumber = 0;

function registrationRequest(body: unknown) {
  requestNumber += 1;
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": `192.0.2.${requestNumber}`,
    },
    body: JSON.stringify(body),
  });
}

function validRegistration(
  role: "student" | "teacher" = "student",
  overrides: Record<string, unknown> = {},
) {
  return {
    email: " New.User@Example.com ",
    password: "Strong8!",
    confirmPassword: "Strong8!",
    role,
    ...overrides,
  };
}

describe("registration route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue(null);
    mocks.createUser.mockImplementation(async ({ email, role, password }) => ({
      id: "new-user",
      email,
      role,
      password,
    }));
    mocks.createSession.mockResolvedValue(undefined);
  });

  it.each(["student", "teacher"] as const)(
    "registers a %s and creates the authenticated session",
    async (role) => {
      const response = await register(
        registrationRequest(validRegistration(role)),
      );
      const body = await response.json();
      const createdUser = mocks.createUser.mock.calls[0][0].data;

      expect(response.status).toBe(201);
      expect(body).toEqual({ success: true, role });
      expect(mocks.findFirst).toHaveBeenCalledWith({
        where: {
          email: { equals: "new.user@example.com", mode: "insensitive" },
        },
        select: { id: true, role: true },
      });
      expect(createdUser).toMatchObject({
        email: "new.user@example.com",
        role,
      });
      expect(createdUser.password).not.toBe("Strong8!");
      await expect(
        verifyPassword("Strong8!", createdUser.password),
      ).resolves.toBe(true);
      expect(mocks.createSession).toHaveBeenCalledWith("new-user");
      expect(body).not.toHaveProperty("password");
      expect(body).not.toHaveProperty("confirmPassword");
    },
  );

  it.each([
    ["invalid email", { email: "not-an-email" }, "valid email"],
    ["Chinese full stop in email", { email: "789@qq。com" }, "valid email"],
    [
      "the exact Chinese full stop address shown in the report",
      { email: "mnb@qq。c0m" },
      "valid email",
    ],
    ["full-width period in email", { email: "789@qq．com" }, "valid email"],
    ["half-width ideographic stop in email", { email: "789@qq｡com" }, "valid email"],
    ["Unicode domain name", { email: "用户@例子.com" }, "valid email"],
    [
      "password shorter than six characters",
      { password: "short", confirmPassword: "short" },
      "6 and 10",
    ],
    [
      "password longer than ten characters",
      { password: "this-is-too-long", confirmPassword: "this-is-too-long" },
      "6 and 10",
    ],
    [
      "mismatched confirmation",
      { confirmPassword: "another-password" },
      "do not match",
    ],
    ["admin role", { role: "admin" }, "student or teacher"],
  ])("rejects %s on the server", async (_case, overrides, errorText) => {
    const response = await register(
      registrationRequest(validRegistration("student", overrides)),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain(errorText);
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("returns a clear duplicate-email error without creating another user", async () => {
    mocks.findFirst.mockResolvedValue({ id: "existing-user", role: "student" });

    const response = await register(
      registrationRequest(validRegistration()),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("already exists");
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it("returns a generic conflict when another request wins the unique-email race", async () => {
    mocks.createUser.mockRejectedValue({ code: "P2002" });

    const response = await register(
      registrationRequest(validRegistration()),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("already exists");
    expect(body.error).not.toContain("P2002");
  });

  it("allows a registered password to sign in using the shared login flow", async () => {
    const registerResponse = await register(
      registrationRequest(validRegistration("teacher")),
    );
    const createdUser = mocks.createUser.mock.calls[0][0].data;
    mocks.findFirst.mockResolvedValue({
      id: "new-user",
      role: "teacher",
      password: createdUser.password,
    });

    const loginResponse = await login(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "new.user@example.com",
          password: "Strong8!",
          role: "teacher",
        }),
      }),
    );

    expect(registerResponse.status).toBe(201);
    expect(loginResponse.status).toBe(200);
    expect(mocks.createSession).toHaveBeenCalledWith("new-user");
  });

  it("limits repeated registration requests and resets after the time window", () => {
    let now = 1_000;
    const isRateLimited = createRegistrationRateLimiter({
      maxAttempts: 2,
      windowMs: 1_000,
      now: () => now,
    });
    const request = new Request("http://localhost/api/auth/register", {
      headers: { "x-forwarded-for": "203.0.113.5" },
    });

    expect(isRateLimited(request)).toBe(false);
    expect(isRateLimited(request)).toBe(false);
    expect(isRateLimited(request)).toBe(true);

    now += 1_000;
    expect(isRateLimited(request)).toBe(false);
  });
});
