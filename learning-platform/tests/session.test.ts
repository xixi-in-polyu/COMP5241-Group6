import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  findUnique: vi.fn(),
  deleteMany: vi.fn(),
  create: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: mocks.cookieGet,
    set: mocks.cookieSet,
  })),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    session: {
      findUnique: mocks.findUnique,
      deleteMany: mocks.deleteMany,
    },
    $transaction: mocks.transaction,
  },
}));

import {
  createSession,
  deleteSession,
  getAuthenticatedUser,
} from "@/lib/auth/session";
import {
  hashSessionToken,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session-core";

describe("database sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookieGet.mockReturnValue(undefined);
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        session: {
          create: mocks.create,
          deleteMany: mocks.deleteMany,
        },
      }),
    );
  });

  it("persists a token digest and sets a secure server cookie", async () => {
    await createSession("user-1");

    expect(mocks.create).toHaveBeenCalledOnce();
    const data = mocks.create.mock.calls[0][0].data;
    expect(data.userId).toBe("user-1");
    expect(data.tokenHash).toHaveLength(64);

    expect(mocks.cookieSet).toHaveBeenCalledOnce();
    const [name, token, options] = mocks.cookieSet.mock.calls[0];
    expect(name).toBe(SESSION_COOKIE_NAME);
    expect(hashSessionToken(token)).toBe(data.tokenHash);
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  });

  it("restores the authenticated user from a valid session", async () => {
    mocks.cookieGet.mockReturnValue({ value: "valid-token" });
    mocks.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: "user-1", email: "student@example.com", role: "student" },
    });

    await expect(getAuthenticatedUser()).resolves.toEqual({
      id: "user-1",
      email: "student@example.com",
      role: "student",
    });
  });

  it("rejects and removes an expired session", async () => {
    mocks.cookieGet.mockReturnValue({ value: "expired-token" });
    mocks.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() - 60_000),
      user: { id: "user-1", email: "student@example.com", role: "student" },
    });

    await expect(getAuthenticatedUser()).resolves.toBeNull();
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: hashSessionToken("expired-token") },
    });
  });

  it("invalidates the database session and expires the cookie on logout", async () => {
    mocks.cookieGet.mockReturnValue({ value: "valid-token" });

    await deleteSession();

    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: hashSessionToken("valid-token") },
    });
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      "",
      expect.objectContaining({ maxAge: 0, httpOnly: true }),
    );
  });
});
