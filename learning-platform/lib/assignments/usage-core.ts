import { createHash } from "node:crypto";

const SECRET_KEY = /cookie|authorization|api[-_]?key|token|secret|password|headers?/i;

export function sanitizeContext(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeContext);
  if (value && typeof value === "object") {
    if (value instanceof Uint8Array || value instanceof ArrayBuffer) return "[binary omitted]";
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SECRET_KEY.test(key) ? "[redacted]" : sanitizeContext(item)]));
  }
  return value;
}

export function payloadInfo(value: unknown) {
  const clean = sanitizeContext(value);
  const serialized = JSON.stringify(clean ?? null);
  return { clean, bytes: Buffer.byteLength(serialized), hash: createHash("sha256").update(serialized).digest("hex") };
}

export function canCapturePayload(payloadBytes: number, storedBytes: number, eventBytes: number, courseBytes: number) {
  return payloadBytes <= eventBytes && storedBytes + payloadBytes <= courseBytes;
}
