"use client";

import {
  PERSONAL_AI_API_KEY_HEADER,
  PERSONAL_AI_ENDPOINT_HEADER,
  PERSONAL_AI_MODEL_HEADER,
  PERSONAL_AI_PROVIDER_HEADER,
  type PersonalAiCredentials,
} from "@/lib/ai/personal-credentials";

const STORAGE_KEY = "learning-platform.personal-ai-credentials.v1";

function validCredentials(value: unknown): value is PersonalAiCredentials {
  return typeof value === "object" && value !== null &&
    typeof (value as PersonalAiCredentials).apiKey === "string" &&
    typeof (value as PersonalAiCredentials).model === "string" &&
    ["openrouter", "deepseek", "openai", "compatible"].includes((value as PersonalAiCredentials).provider) &&
    typeof (value as PersonalAiCredentials).endpoint === "string";
}

export function getPersonalAiCredentials(): PersonalAiCredentials | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const credentials: unknown = JSON.parse(raw);
    if (!validCredentials(credentials) || !credentials.apiKey.trim() || !credentials.model.trim()) {
      return null;
    }
    return {
      apiKey: credentials.apiKey.trim(),
      model: credentials.model.trim(),
      provider: credentials.provider,
      endpoint: credentials.endpoint.trim(),
    };
  } catch {
    return null;
  }
}

export function savePersonalAiCredentials(credentials: PersonalAiCredentials) {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
}

export function clearPersonalAiCredentials() {
  window.sessionStorage.removeItem(STORAGE_KEY);
}

export function personalAiHeaders(): HeadersInit {
  const credentials = getPersonalAiCredentials();
  return credentials
    ? {
        [PERSONAL_AI_API_KEY_HEADER]: credentials.apiKey,
        [PERSONAL_AI_MODEL_HEADER]: credentials.model,
        [PERSONAL_AI_PROVIDER_HEADER]: credentials.provider,
        [PERSONAL_AI_ENDPOINT_HEADER]: credentials.endpoint,
      }
    : {};
}
