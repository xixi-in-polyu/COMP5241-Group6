import { describe, expect, it } from "vitest";

import {
  createSessionToken,
  getSessionExpiration,
  hashSessionToken,
  isRole,
  isSessionExpired,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/session-core";

describe("session primitives", () => {
  it("creates unique opaque tokens and deterministic digests", () => {
    const first = createSessionToken();
    const second = createSessionToken();

    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(40);
    expect(hashSessionToken(first)).toHaveLength(64);
    expect(hashSessionToken(first)).toBe(hashSessionToken(first));
    expect(hashSessionToken(first)).not.toContain(first);
  });

  it("uses an explicit seven-day expiration", () => {
    const now = new Date("2026-10-19T00:00:00.000Z");
    const expiresAt = getSessionExpiration(now);

    expect(expiresAt.getTime() - now.getTime()).toBe(
      SESSION_MAX_AGE_SECONDS * 1000,
    );
    expect(isSessionExpired(expiresAt, new Date(expiresAt.getTime() - 1))).toBe(false);
    expect(isSessionExpired(expiresAt, expiresAt)).toBe(true);
  });

  it("accepts only application roles", () => {
    expect(isRole("student")).toBe(true);
    expect(isRole("teacher")).toBe(true);
    expect(isRole("admin")).toBe(true);
    expect(isRole("owner")).toBe(false);
  });
});
