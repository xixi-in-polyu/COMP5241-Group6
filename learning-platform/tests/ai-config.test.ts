import { describe, expect, it } from "vitest";
import { getAiConfig } from "@/lib/ai/config";

describe("AI provider configuration", () => {
  it("uses the current DeepSeek official defaults", () => {
    expect(getAiConfig({ AI_PROVIDER: "deepseek", AI_API_KEY: "test" })).toMatchObject({
      provider: "deepseek",
      endpoint: "https://api.deepseek.com",
      model: "deepseek-flash",
      configured: true,
    });
  });

  it("requires an explicit PolyU endpoint and model", () => {
    expect(getAiConfig({ AI_PROVIDER: "polyu", AI_API_KEY: "test" }).configured).toBe(false);
    expect(getAiConfig({
      AI_PROVIDER: "polyu",
      AI_ENDPOINT: "https://llm.example.polyu.edu.hk/v1/chat/completions",
      AI_API_KEY: "test",
      AI_MODEL: "deepseek",
    })).toMatchObject({
      provider: "polyu",
      endpoint: "https://llm.example.polyu.edu.hk/v1",
      model: "deepseek",
      configured: true,
    });
  });

  it("uses OpenRouter's free router and optional attribution headers", () => {
    expect(getAiConfig({
      AI_PROVIDER: "openrouter",
      AI_API_KEY: "test",
      OPENROUTER_SITE_URL: "http://localhost:3000",
      OPENROUTER_APP_NAME: "Learning Platform",
    })).toMatchObject({
      provider: "openrouter",
      endpoint: "https://openrouter.ai/api/v1",
      model: "openrouter/free",
      defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Learning Platform",
      },
      configured: true,
    });
  });

  it("keeps provider-specific variables as a compatibility fallback", () => {
    expect(getAiConfig({
      AI_PROVIDER: "deepseek",
      DEEPSEEK_API_KEY: "legacy-key",
      DEEPSEEK_BASE_URL: "https://gateway.example/v1/",
      DEEPSEEK_MODEL: "custom-deepseek",
    })).toMatchObject({
      apiKey: "legacy-key",
      endpoint: "https://gateway.example/v1",
      model: "custom-deepseek",
      configured: true,
    });
  });
});
