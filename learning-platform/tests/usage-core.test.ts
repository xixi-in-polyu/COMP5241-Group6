import { describe, expect, it } from "vitest";
import { canCapturePayload, payloadInfo, sanitizeContext } from "@/lib/assignments/usage-core";

describe("usage context safety", () => {
  it("redacts credentials, headers, and binary content recursively", () => {
    expect(sanitizeContext({ authorization: "Bearer secret", nested: { apiKey: "secret", prompt: "safe" }, file: new Uint8Array([1, 2]) })).toEqual({ authorization: "[redacted]", nested: { apiKey: "[redacted]", prompt: "safe" }, file: "[binary omitted]" });
  });

  it("reports deterministic byte size and hash", () => {
    expect(payloadInfo({ prompt: "hello" })).toEqual(payloadInfo({ prompt: "hello" }));
    expect(payloadInfo({ prompt: "hello" }).bytes).toBeGreaterThan(0);
  });

  it("enforces both per-event and per-course limits", () => {
    expect(canCapturePayload(2_000_000, 90_000_000, 2_097_152, 104_857_600)).toBe(true);
    expect(canCapturePayload(2_100_000, 0, 2_097_152, 104_857_600)).toBe(false);
    expect(canCapturePayload(1_000_000, 104_000_000, 2_097_152, 104_857_600)).toBe(false);
  });
});
