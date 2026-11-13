import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  PERSONAL_AI_API_KEY_HEADER,
  PERSONAL_AI_ENDPOINT_HEADER,
  PERSONAL_AI_MODEL_HEADER,
  PERSONAL_AI_PROVIDER_HEADER,
} from "@/lib/ai/personal-credentials";
import { getRequestAiConfig } from "@/lib/ai/request-config";

describe("request AI configuration", () => {
  it("uses a personal OpenRouter credential for one request", () => {
    const request = new Request("https://example.test/api/chat", {
      headers: {
        [PERSONAL_AI_API_KEY_HEADER]: "sk-or-v1-personal-key",
        [PERSONAL_AI_MODEL_HEADER]: "openai/gpt-4.1-mini",
        [PERSONAL_AI_PROVIDER_HEADER]: "openrouter",
        [PERSONAL_AI_ENDPOINT_HEADER]: "https://openrouter.ai/api/v1",
      },
    });

    expect(getRequestAiConfig(request)).toMatchObject({
      provider: "openrouter",
      endpoint: "https://openrouter.ai/api/v1",
      apiKey: "sk-or-v1-personal-key",
      model: "openai/gpt-4.1-mini",
      structuredOutputMode: "chat-json-schema",
      configured: true,
    });
  });

  it("rejects a partial personal AI configuration", () => {
    const request = new Request("https://example.test/api/chat", {
      headers: { [PERSONAL_AI_API_KEY_HEADER]: "sk-or-v1-personal-key" },
    });

    expect(() => getRequestAiConfig(request)).toThrow(
      "Personal AI settings must include a provider, endpoint, API key, and model.",
    );
  });

  it("uses DeepSeek's official endpoint for a personal DeepSeek key", () => {
    const request = new Request("https://example.test/api/chat", {
      headers: {
        [PERSONAL_AI_API_KEY_HEADER]: "deepseek-personal-key",
        [PERSONAL_AI_MODEL_HEADER]: "deepseek-chat",
        [PERSONAL_AI_PROVIDER_HEADER]: "deepseek",
        [PERSONAL_AI_ENDPOINT_HEADER]: "https://api.deepseek.com",
      },
    });

    expect(getRequestAiConfig(request)).toMatchObject({
      provider: "deepseek",
      endpoint: "https://api.deepseek.com",
      model: "deepseek-chat",
      configured: true,
    });
  });

  it("rejects an unapproved compatible endpoint", () => {
    const request = new Request("https://example.test/api/chat", {
      headers: {
        [PERSONAL_AI_API_KEY_HEADER]: "custom-key",
        [PERSONAL_AI_MODEL_HEADER]: "custom-model",
        [PERSONAL_AI_PROVIDER_HEADER]: "compatible",
        [PERSONAL_AI_ENDPOINT_HEADER]: "https://unapproved.example/v1",
      },
    });

    expect(() => getRequestAiConfig(request)).toThrow(
      "This compatible API endpoint has not been approved by the platform administrator.",
    );
  });
});
