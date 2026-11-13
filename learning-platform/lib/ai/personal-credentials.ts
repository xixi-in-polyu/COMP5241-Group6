import type { AiConfig } from "@/lib/ai/config";

export const PERSONAL_AI_API_KEY_HEADER = "x-personal-ai-api-key";
export const PERSONAL_AI_MODEL_HEADER = "x-personal-ai-model";
export const PERSONAL_AI_PROVIDER_HEADER = "x-personal-ai-provider";
export const PERSONAL_AI_ENDPOINT_HEADER = "x-personal-ai-endpoint";

export type PersonalAiProvider = "openrouter" | "deepseek" | "openai" | "compatible";

export type PersonalAiCredentials = Pick<AiConfig, "apiKey" | "model"> & {
  provider: PersonalAiProvider;
  endpoint: string;
};
