import "server-only";

import { createHash, randomBytes } from "node:crypto";

export function createShareToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashShareToken(token) };
}

export function hashShareToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function safeDownloadName(name: string) {
  const cleaned = name.replace(/[\r\n"\\/]/g, "_").trim();
  return cleaned || "course-material";
}
