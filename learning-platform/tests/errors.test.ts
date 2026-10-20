import { describe, expect, it } from "vitest";

import { describeError, errorMessage } from "@/lib/errors";

describe("describeError", () => {
  it("keeps the message, name, and stack of a real Error", () => {
    const error = new Error("Transaction API error: expired transaction.");
    const result = describeError(error);

    expect(result.message).toBe("Transaction API error: expired transaction.");
    expect(result.name).toBe("Error");
    expect(result.stack).toContain("Transaction API error");
  });

  it("reads a serialized error that crossed the workflow/step boundary", () => {
    const serialized = {
      name: "PrismaClientKnownRequestError",
      message: "Transaction API error: A query cannot be executed on an expired transaction.",
      stack: "at replaceAssignmentEntities",
    };

    const result = describeError(serialized);

    expect(result.message).toContain("expired transaction");
    expect(result.name).toBe("PrismaClientKnownRequestError");
    expect(result.stack).toBe("at replaceAssignmentEntities");
    expect(errorMessage(serialized)).toContain("expired transaction");
  });

  it("serializes an object that only carries details", () => {
    expect(errorMessage({ code: "P2028", timeout: 5000 })).toContain("P2028");
  });

  it("never returns an empty message", () => {
    expect(errorMessage(new Error(""))).toBe("Error");
    expect(errorMessage("  ")).toBe("Unknown workflow error.");
    expect(errorMessage({})).toBe("Unknown workflow error.");
    expect(errorMessage(null)).toBe("null");
    expect(errorMessage(undefined)).toBe("undefined");
    expect(errorMessage(42)).toBe("42");
  });
});
