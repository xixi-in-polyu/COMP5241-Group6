import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({
  responsesCreate: vi.fn(),
  chatCreate: vi.fn(),
  recordUsage: vi.fn(),
  config: {
    provider: "deepseek",
    apiKey: "test",
    endpoint: "https://api.deepseek.com",
    model: "deepseek-flash",
    structuredOutputMode: "responses-json-schema",
    configured: true,
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  },
}));
vi.mock("openai", () => ({
  default: class MockOpenAI {
    responses = { create: mocks.responsesCreate };
    chat = { completions: { create: mocks.chatCreate } };
  },
}));
vi.mock("@/lib/ai/config", () => ({ getAiConfig: () => mocks.config }));
vi.mock("@/lib/mini-courses/ai-usage", () => ({
  recordMiniCourseAiUsage: mocks.recordUsage,
}));

import { structured } from "@/lib/mini-courses/ai";

const schema = z.object({ value: z.string().min(2) });

function request() {
  return {
    schema,
    name: "test_output",
    developer: "Return the requested value.",
    data: { requested: "ok" },
    maxTokens: 200,
    operation: "course_draft" as const,
    userId: "user",
    courseId: "course",
  };
}

describe("mini-course structured output", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mocks.config, {
      provider: "deepseek",
      apiKey: "test",
      endpoint: "https://api.deepseek.com",
      model: "deepseek-flash",
      structuredOutputMode: "responses-json-schema",
      configured: true,
    });
  });

  it("uses strict Responses JSON Schema for DeepSeek", async () => {
    mocks.responsesCreate.mockResolvedValue({
      output_text: '{"value":"ok"}',
      status: "completed",
      incomplete_details: null,
      usage: { input_tokens: 10, output_tokens: 4, total_tokens: 14 },
    });

    await expect(structured(request())).resolves.toEqual({ value: "ok" });
    expect(mocks.chatCreate).not.toHaveBeenCalled();
    expect(mocks.responsesCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: "deepseek-flash",
      max_output_tokens: 200,
      reasoning: { effort: "none" },
      text: { format: expect.objectContaining({ type: "json_schema", strict: true }) },
    }));
  });

  it("requires JSON Schema support from OpenRouter's selected endpoint", async () => {
    Object.assign(mocks.config, {
      provider: "openrouter",
      endpoint: "https://openrouter.ai/api/v1",
      model: "openrouter/free",
      structuredOutputMode: "chat-json-schema",
    });
    mocks.chatCreate.mockResolvedValue({
      choices: [{ message: { content: '{"value":"ok"}' }, finish_reason: "stop" }],
      usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
    });

    await expect(structured(request())).resolves.toEqual({ value: "ok" });
    expect(mocks.responsesCreate).not.toHaveBeenCalled();
    expect(mocks.chatCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: "openrouter/free",
      provider: { require_parameters: true },
      response_format: expect.objectContaining({
        type: "json_schema",
        json_schema: expect.objectContaining({ strict: true }),
      }),
    }));
  });

  it("repairs empty output from a JSON Object compatibility gateway", async () => {
    Object.assign(mocks.config, {
      provider: "polyu",
      endpoint: "https://llm.example/v1",
      model: "custom-model",
      structuredOutputMode: "chat-json-object",
    });
    mocks.chatCreate
      .mockResolvedValueOnce({
        choices: [{ message: { content: "   " }, finish_reason: "stop" }],
        usage: { prompt_tokens: 10, completion_tokens: 1, total_tokens: 11 },
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: '{"value":"ok"}' }, finish_reason: "stop" }],
        usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 },
      });

    await expect(structured(request())).resolves.toEqual({ value: "ok" });
    expect(mocks.chatCreate).toHaveBeenCalledTimes(2);
    const firstRequest = mocks.chatCreate.mock.calls[0][0];
    const secondRequest = mocks.chatCreate.mock.calls[1][0];
    expect(firstRequest.response_format).toEqual({ type: "json_object" });
    expect(firstRequest.messages[0].content).toContain("Example output shape:");
    expect(secondRequest.messages.at(-1).content).toContain("model returned empty output");
    expect(mocks.recordUsage).toHaveBeenCalledWith(expect.objectContaining({
      usage: { inputTokens: 22, outputTokens: 5, totalTokens: 27 },
    }));
  });

  it("reports which AI configuration values are missing", async () => {
    Object.assign(mocks.config, {
      apiKey: "",
      endpoint: "",
      model: "deepseek-flash",
      configured: false,
    });

    await expect(structured(request())).rejects.toMatchObject({
      status: 503,
      message: "AI service configuration is incomplete for deepseek: missing API key, endpoint.",
    });
    expect(mocks.responsesCreate).not.toHaveBeenCalled();
  });

  it("returns provider diagnostics without exposing credentials", async () => {
    Object.assign(mocks.config, { apiKey: "sk-super-secret-key" });
    const providerError = Object.assign(
      new Error("Authentication failed for Bearer sk-super-secret-key"),
      {
        status: 401,
        code: "invalid_api_key",
        request_id: "req_abc123",
      },
    );
    mocks.responsesCreate.mockRejectedValue(providerError);

    await expect(structured(request())).rejects.toMatchObject({
      status: 503,
      message:
        "AI request failed (provider: deepseek, model: deepseek-flash, HTTP 401, code: invalid_api_key, request ID: req_abc123): Authentication failed for Bearer [redacted]",
    });
    expect(mocks.recordUsage).toHaveBeenCalledWith(expect.objectContaining({
      status: "FAILED",
      errorDetail:
        "AI request failed (provider: deepseek, model: deepseek-flash, HTTP 401, code: invalid_api_key, request ID: req_abc123): Authentication failed for Bearer [redacted]",
    }));
  });
});
