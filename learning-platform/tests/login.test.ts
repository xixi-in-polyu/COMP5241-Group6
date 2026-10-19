import { beforeEach, describe, expect, it, vi } from "vitest";

type MockUser = {
  id: string;
  email: string;
  role: string;
  password: string;
};

const mocks = vi.hoisted(() => ({
  users: new Map<string, MockUser>(),
  findFirst: vi.fn(
    async (args: {
      where: { email: { equals: string }; role?: string };
    }) => {
      const user = mocks.users.get(args.where.email.equals.toLowerCase());
      if (!user || (args.where.role && user.role !== args.where.role)) {
        return null;
      }
      return { ...user };
    },
  ),
  createUser: vi.fn(
    async (args: { data: Omit<MockUser, "id"> }) => {
      const user = { ...args.data, id: `user-${mocks.users.size + 1}` };
      mocks.users.set(user.email.toLowerCase(), user);
      return { id: user.id, role: user.role };
    },
  ),
  updateUser: vi.fn(
    async (args: { where: { id: string }; data: { password: string } }) => {
      const user = [...mocks.users.values()].find(
        (entry) => entry.id === args.where.id,
      );
      if (user) {
        user.password = args.data.password;
      }
      return user;
    },
  ),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: mocks.findFirst,
      create: mocks.createUser,
      update: mocks.updateUser,
    },
  },
}));
vi.mock("@/lib/auth/session", () => ({
  createSession: mocks.createSession,
  deleteSession: mocks.deleteSession,
}));

import { POST as login } from "@/app/api/auth/login/route";
import { POST as register } from "@/app/api/auth/register/route";
import { isPasswordHash, verifyPassword } from "@/lib/auth/password";

let registrationRequestNumber = 0;

function postJson(path: string, body: unknown, registration = false) {
  registrationRequestNumber += 1;
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(registration
        ? { "x-forwarded-for": `198.51.100.${registrationRequestNumber}` }
        : {}),
    },
    body: JSON.stringify(body),
  });
}

function registrationBody(
  role: "student" | "teacher",
  overrides: Record<string, unknown> = {},
) {
  return {
    email: `${role}@example.com`,
    password: "Strong8!",
    confirmPassword: "Strong8!",
    role,
    ...overrides,
  };
}

describe("POST /api/auth/login and public registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.users.clear();
  });

  it.each(["student", "teacher"] as const)(
    "%s can register with a unique email and then sign in",
    async (role) => {
      const email = `${role}@example.com`;
      const password = "Strong8!";

      const registrationResponse = await register(
        postJson(
          "/api/auth/register",
          registrationBody(role),
          true,
        ),
      );
      const registrationResult = await registrationResponse.json();

      expect(registrationResponse.status).toBe(201);
      expect(registrationResult).toEqual({ success: true, role });
      expect(mocks.createUser).toHaveBeenCalledOnce();
      expect(mocks.createSession).toHaveBeenCalledWith("user-1");

      const storedUser = mocks.users.get(email);
      expect(storedUser).toBeDefined();
      expect(storedUser?.password).not.toBe(password);
      expect(isPasswordHash(storedUser!.password)).toBe(true);
      await expect(verifyPassword(password, storedUser!.password)).resolves.toBe(
        true,
      );

      vi.clearAllMocks();
      const loginResponse = await login(
        postJson("/api/auth/login", { email, password, role }),
      );

      expect(loginResponse.status).toBe(200);
      await expect(loginResponse.json()).resolves.toEqual({
        success: true,
        role,
      });
      expect(mocks.findFirst).toHaveBeenCalledWith({
        where: {
          email: { equals: email, mode: "insensitive" },
          role,
        },
        select: { id: true, role: true, password: true },
      });
      expect(mocks.createSession).toHaveBeenCalledWith("user-1");
    },
  );

  it("does not allow admin registration", async () => {
    const response = await register(
      postJson(
        "/api/auth/register",
        registrationBody("student", { role: "admin" }),
        true,
      ),
    );

    expect(response.status).toBe(400);
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid email syntax", { email: "invalid-email" }],
    ["Chinese punctuation in the domain", { email: "user@qq。com" }],
    ["invalid top-level domain", { email: "mnb@qq.c0m" }],
    ["weak password", { password: "short", confirmPassword: "short" }],
    ["mismatched password confirmation", { confirmPassword: "Mismatch8!" }],
  ])("rejects registration with %s", async (_scenario, overrides) => {
    const response = await register(
      postJson(
        "/api/auth/register",
        registrationBody("student", overrides),
        true,
      ),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toHaveProperty("error");
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("rejects duplicate registration without creating a second user", async () => {
    const body = registrationBody("student");
    await register(postJson("/api/auth/register", body, true));

    const duplicateResponse = await register(
      postJson("/api/auth/register", body, true),
    );

    expect(duplicateResponse.status).toBe(409);
    expect(await duplicateResponse.json()).toMatchObject({
      error: expect.stringContaining("already exists"),
    });
    expect(mocks.createUser).toHaveBeenCalledOnce();
  });

  it("rejects invalid login credentials without creating a session", async () => {
    const response = await login(
      postJson("/api/auth/login", {
        email: "missing@example.com",
        password: "wrong",
        role: "student",
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toHaveProperty("error");
    expect(mocks.createSession).not.toHaveBeenCalled();
  });
});
