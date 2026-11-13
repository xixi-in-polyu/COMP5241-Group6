import "server-only";

import { getAiConfig, type AiConfig } from "@/lib/ai/config";
import {
  PERSONAL_AI_API_KEY_HEADER,
  PERSONAL_AI_ENDPOINT_HEADER,
  PERSONAL_AI_MODEL_HEADER,
  PERSONAL_AI_PROVIDER_HEADER,
  type PersonalAiProvider,
} from "@/lib/ai/personal-credentials";

const knownEndpoints = {
  openrouter: "https://openrouter.ai/api/v1",
  deepseek: "https://api.deepseek.com",
  openai: "https://api.openai.com/v1",
} as const;

function headerValue(request: Request, name: string) {
  return request.headers.get(name)?.trim() ?? "";
}

function normalizedHttpsEndpoint(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("Personal AI endpoint must be a plain HTTPS URL.");
  }
  return url.toString()
    .replace(/\/(chat\/completions|responses)\/?$/i, "")
    .replace(/\/$/, "");
}

function allowedCompatibleEndpoints() {
  return (process.env.PERSONAL_AI_ALLOWED_ENDPOINTS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .flatMap((value) => {
      try {
        return [normalizedHttpsEndpoint(value)];
      } catch {
        console.warn("Ignoring invalid PERSONAL_AI_ALLOWED_ENDPOINTS entry.");
        return [];
      }
    });
}

/**
 * Uses a caller's OpenRouter credential for this request only. The credential
 * is supplied by the browser and is deliberately not persisted by the server.
 */
export function getRequestAiConfig(request: Request): AiConfig {
  const apiKey = headerValue(request, PERSONAL_AI_API_KEY_HEADER);
  const model = headerValue(request, PERSONAL_AI_MODEL_HEADER);
  const provider = headerValue(request, PERSONAL_AI_PROVIDER_HEADER);
  const endpoint = headerValue(request, PERSONAL_AI_ENDPOINT_HEADER);

  if (!apiKey && !model && !provider && !endpoint) return getAiConfig();
  if (!apiKey || !model || !provider || !endpoint) {
    throw new Error("Personal AI settings must include a provider, endpoint, API key, and model.");
  }
  if (apiKey.length > 512 || model.length > 200 || endpoint.length > 2_000 || /[\r\n]/.test(apiKey + model + provider + endpoint)) {
    throw new Error("Personal AI settings are invalid.");
  }

  const selectedProvider = provider as PersonalAiProvider;
  if (!["openrouter", "deepseek", "openai", "compatible"].includes(selectedProvider)) {
    throw new Error("Personal AI provider is not supported.");
  }
  const expectedEndpoint = selectedProvider === "compatible"
    ? normalizedHttpsEndpoint(endpoint)
    : knownEndpoints[selectedProvider];
  if (selectedProvider !== "compatible" && normalizedHttpsEndpoint(endpoint) !== expectedEndpoint) {
    throw new Error("The selected provider must use its official API endpoint.");
  }
  if (selectedProvider === "compatible" && !allowedCompatibleEndpoints().includes(expectedEndpoint)) {
    throw new Error("This compatible API endpoint has not been approved by the platform administrator.");
  }

  return getAiConfig({
    ...process.env,
    AI_PROVIDER: selectedProvider === "compatible" ? "polyu" : selectedProvider,
    AI_ENDPOINT: expectedEndpoint,
    AI_API_KEY: apiKey,
    AI_MODEL: model,
    ...(selectedProvider === "compatible" ? { AI_STRUCTURED_OUTPUT_MODE: "chat-json-object" } : {}),
  });
}
