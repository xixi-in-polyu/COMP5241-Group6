export type AiProvider = "openai" | "deepseek" | "polyu" | "openrouter";
export type StructuredOutputMode =
  | "responses-json-schema"
  | "chat-json-schema"
  | "chat-json-object";

type Environment = Record<string, string | undefined>;

export type AiConfig = {
  provider: AiProvider;
  apiKey: string;
  endpoint: string;
  model: string;
  structuredOutputMode: StructuredOutputMode;
  defaultHeaders?: Record<string, string>;
  configured: boolean;
};

const providers = new Set<AiProvider>([
  "openai",
  "deepseek",
  "polyu",
  "openrouter",
]);

const structuredOutputModes = new Set<StructuredOutputMode>([
  "responses-json-schema",
  "chat-json-schema",
  "chat-json-object",
]);

function getStructuredOutputMode(
  provider: AiProvider,
  environment: Environment,
): StructuredOutputMode {
  const requested = environment.AI_STRUCTURED_OUTPUT_MODE?.trim().toLowerCase();
  if (requested && requested !== "auto") {
    if (!structuredOutputModes.has(requested as StructuredOutputMode)) {
      throw new Error(
        `Unsupported AI_STRUCTURED_OUTPUT_MODE "${requested}". Use auto, responses-json-schema, chat-json-schema, or chat-json-object.`,
      );
    }
    return requested as StructuredOutputMode;
  }

  if (provider === "openai" || provider === "deepseek") {
    return "responses-json-schema";
  }
  if (provider === "openrouter") {
    return "chat-json-schema";
  }
  return "chat-json-object";
}

export function getAiProvider(environment: Environment = process.env): AiProvider {
  const requested = environment.AI_PROVIDER?.trim().toLowerCase();
  if (requested) {
    if (!providers.has(requested as AiProvider)) {
      throw new Error(
        `Unsupported AI_PROVIDER "${requested}". Use openai, deepseek, polyu, or openrouter.`,
      );
    }
    return requested as AiProvider;
  }
  if (environment.OPENROUTER_API_KEY) return "openrouter";
  if (environment.DEEPSEEK_API_KEY) return "deepseek";
  return "openai";
}

function normalizeEndpoint(value: string) {
  return value
    .trim()
    .replace(/\/(chat\/completions|responses)\/?$/i, "")
    .replace(/\/+$/, "");
}

export function getAiConfig(environment: Environment = process.env): AiConfig {
  const provider = getAiProvider(environment);
  const providerEndpoint = {
    openai: environment.OPENAI_BASE_URL || "https://api.openai.com/v1",
    deepseek: environment.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    polyu: environment.POLYU_AI_ENDPOINT || "",
    openrouter: environment.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
  }[provider];
  const providerKey = {
    openai: environment.OPENAI_API_KEY,
    deepseek: environment.DEEPSEEK_API_KEY,
    polyu: environment.POLYU_AI_API_KEY || environment.DEEPSEEK_API_KEY,
    openrouter: environment.OPENROUTER_API_KEY,
  }[provider];
  const providerModel = {
    openai: environment.OPENAI_MODEL || "gpt-4.1-mini",
    deepseek: environment.DEEPSEEK_MODEL || "deepseek-flash",
    polyu: environment.POLYU_AI_MODEL || environment.DEEPSEEK_MODEL || "",
    openrouter: environment.OPENROUTER_MODEL || "openrouter/free",
  }[provider];
  const endpoint = normalizeEndpoint(environment.AI_ENDPOINT || providerEndpoint);
  const apiKey = (environment.AI_API_KEY || providerKey || "").trim();
  const model = (environment.AI_MODEL || providerModel).trim();
  const structuredOutputMode = getStructuredOutputMode(provider, environment);
  const defaultHeaders = provider === "openrouter"
    ? Object.fromEntries(
        [
          ["HTTP-Referer", environment.OPENROUTER_SITE_URL],
          ["X-Title", environment.OPENROUTER_APP_NAME],
        ].filter((entry): entry is [string, string] => Boolean(entry[1])),
      )
    : undefined;

  return {
    provider,
    apiKey,
    endpoint,
    model,
    structuredOutputMode,
    ...(defaultHeaders && Object.keys(defaultHeaders).length ? { defaultHeaders } : {}),
    configured: Boolean(apiKey && endpoint && model),
  };
}
