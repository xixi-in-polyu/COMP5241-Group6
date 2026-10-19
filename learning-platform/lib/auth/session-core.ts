import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE_NAME = "learning_platform_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type Role = "student" | "teacher" | "admin";

export function isRole(value: unknown): value is Role {
  return value === "student" || value === "teacher" || value === "admin";
}

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getSessionExpiration(now = new Date()) {
  return new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);
}

export function isSessionExpired(expiresAt: Date, now = new Date()) {
  return expiresAt.getTime() <= now.getTime();
}
