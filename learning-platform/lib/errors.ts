export type DescribedError = {
  message: string;
  name: string;
  stack?: string;
};

const FALLBACK_MESSAGE = "Unknown workflow error.";

/**
 * Errors raised inside a `"use step"` function cross the workflow/step
 * boundary as serialized values, which drops the `Error` prototype. Reading
 * `error.message` through an `instanceof Error` check therefore loses the
 * real reason, so describe any thrown value here instead.
 */
export function describeError(error: unknown): DescribedError {
  if (error instanceof Error) {
    return {
      message: error.message.trim() || error.name,
      name: error.name,
      ...(error.stack ? { stack: error.stack } : {}),
    };
  }

  if (typeof error === "string") {
    return { message: error.trim() || FALLBACK_MESSAGE, name: "Error" };
  }

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    const name =
      typeof record.name === "string" && record.name ? record.name : "Error";
    const message = typeof record.message === "string" ? record.message.trim() : "";
    const stack = typeof record.stack === "string" ? record.stack : undefined;
    if (message) return { message, name, ...(stack ? { stack } : {}) };

    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== "{}") {
        return { message: serialized.slice(0, 500), name };
      }
    } catch {
      // Circular payloads fall through to the generic message.
    }

    return {
      message: name === "Error" ? FALLBACK_MESSAGE : `${name}: ${FALLBACK_MESSAGE}`,
      name,
    };
  }

  return { message: String(error), name: "Error" };
}

export function errorMessage(error: unknown): string {
  return describeError(error).message;
}
