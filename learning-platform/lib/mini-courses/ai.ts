import "server-only";

import { z } from "zod";
import OpenAI from "openai";
import { zodResponseFormat, zodTextFormat } from "openai/helpers/zod";

import { ApiError } from "@/lib/api";
import { getAiConfig, type AiConfig } from "@/lib/ai/config";
import { truncateCourseSources } from "@/lib/courses/source-budget";
import { promptSchema } from "@/lib/ai/schema-prompt";
import { recordMiniCourseAiUsage } from "./ai-usage";

/**
 * AI calls for mini-courses.
 *
 * This follows the same shape as `lib/assignments/ai.ts`: one `structured`
 * helper that reads the project-wide provider configuration, asks for a JSON
 * object that matches a Zod schema, and records what it spent. There is nothing
 * provider-specific here; switching between openai, deepseek, polyu or
 * openrouter is a configuration change, not a code change.
 */

const MAX_PUBLIC_ERROR_LENGTH = 400;

export type AiOperation = "course_draft" | "course_chapters";

type ConversationMessage = {
  role: "developer" | "system" | "user" | "assistant";
  content: string;
};

type TokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

type ModelReply = {
  raw: string;
  finishReason: string;
  usage: TokenUsage;
};

function client() {
  const config = getAiConfig();
  if (!config.configured) {
    const missing = [
      !config.apiKey && "API key",
      !config.endpoint && "endpoint",
      !config.model && "model",
    ].filter(Boolean);
    throw new ApiError(
      503,
      `AI service configuration is incomplete for ${config.provider}: missing ${missing.join(", ")}.`,
    );
  }
  return {
    config,
    openai: new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.endpoint,
      maxRetries: 0,
      ...(config.defaultHeaders ? { defaultHeaders: config.defaultHeaders } : {}),
    }),
  };
}

function publicErrorDetail(error: unknown, apiKey: string): string {
  const raw = error instanceof Error ? error.message : String(error);
  return (apiKey ? raw.replaceAll(apiKey, "[redacted]") : raw)
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PUBLIC_ERROR_LENGTH);
}

function providerFailureMessage(error: unknown, config: AiConfig): string {
  const providerError = error as {
    status?: unknown;
    code?: unknown;
    request_id?: unknown;
    headers?: { get?: (name: string) => string | null };
  };
  const status = typeof providerError.status === "number" ? providerError.status : undefined;
  const code = typeof providerError.code === "string" ? providerError.code : undefined;
  const requestId =
    typeof providerError.request_id === "string"
      ? providerError.request_id
      : providerError.headers?.get?.("x-request-id") ?? undefined;
  const context = [
    `provider: ${config.provider}`,
    `model: ${config.model}`,
    status && `HTTP ${status}`,
    code && `code: ${code}`,
    requestId && `request ID: ${requestId}`,
  ].filter(Boolean);
  const detail = publicErrorDetail(error, config.apiKey);
  return `AI request failed (${context.join(", ")})${detail ? `: ${detail}` : "."}`;
}

function parseJsonLoose(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("model returned empty output");
  }
  const unfenced = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(unfenced.slice(start, end + 1));
    }
    throw new Error("model returned non-JSON output");
  }
}

function complaintFor(error: unknown, finishReason: string): string {
  if (finishReason === "length" || finishReason === "max_output_tokens") {
    return "the reply reached its output-token limit before producing valid JSON";
  }
  if (error instanceof z.ZodError) {
    return error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
  }
  return `the reply was not valid JSON (${error instanceof Error ? error.message : String(error)})`;
}

function addUsage(total: TokenUsage, usage: TokenUsage): TokenUsage {
  const add = (left?: number, right?: number) =>
    left === undefined && right === undefined ? undefined : (left ?? 0) + (right ?? 0);
  return {
    inputTokens: add(total.inputTokens, usage.inputTokens),
    outputTokens: add(total.outputTokens, usage.outputTokens),
    totalTokens: add(total.totalTokens, usage.totalTokens),
  };
}

async function askWithRepair<T>(input: {
  ask: () => Promise<ModelReply>;
  conversation: ConversationMessage[];
  schema: z.ZodType<T>;
  config: AiConfig;
  operation: AiOperation;
}): Promise<{ parsed: T; usage: TokenUsage }> {
  let usage: TokenUsage = {};

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const reply = await input.ask();
    usage = addUsage(usage, reply.usage);
    try {
      return {
        parsed: input.schema.parse(parseJsonLoose(reply.raw)),
        usage,
      };
    } catch (error) {
      if (attempt === 2) throw error;
      const complaint = complaintFor(error, reply.finishReason);
      console.warn(`[mini-course-ai:${input.operation}] retrying after a rejected reply`, {
        provider: input.config.provider,
        model: input.config.model,
        structuredOutputMode: input.config.structuredOutputMode,
        attempt,
        finishReason: reply.finishReason,
        contentLength: reply.raw.length,
        trimmedContentLength: reply.raw.trim().length,
        complaint,
      });
      const rejected = reply.raw.trim();
      if (rejected) {
        input.conversation.push({ role: "assistant", content: rejected });
      }
      input.conversation.push({
        role: "user",
        content: `That reply was rejected: ${complaint}. Return the corrected JSON object only. Every string value must be valid JSON — escape double quotes and do not put raw line breaks inside a string — and every required field must be present.`,
      });
    }
  }

  throw new Error("The provider did not return valid structured output.");
}

export async function structured<T>(input: {
  schema: z.ZodType<T>;
  name: string;
  developer: string;
  data: unknown;
  maxTokens: number;
  operation: AiOperation;
  userId: string;
  courseId: string;
}): Promise<T> {
  const started = Date.now();
  let activeConfig: AiConfig | undefined;

  try {
    const { config, openai } = client();
    activeConfig = config;
    let result: { parsed: T; usage: TokenUsage };

    if (config.structuredOutputMode === "responses-json-schema") {
      const conversation: ConversationMessage[] = [
        { role: "developer", content: input.developer },
        { role: "user", content: JSON.stringify(input.data) },
      ];
      result = await askWithRepair({
        schema: input.schema,
        config,
        operation: input.operation,
        conversation,
        ask: async () => {
          const response = await openai.responses.create({
            model: config.model,
            input: conversation,
            text: { format: zodTextFormat(input.schema, input.name) },
            max_output_tokens: input.maxTokens,
            ...(config.provider === "deepseek"
              ? { reasoning: { effort: "none" as const } }
              : {}),
          });
          return {
            raw: response.output_text,
            finishReason: response.incomplete_details?.reason ?? response.status ?? "unknown",
            usage: {
              inputTokens: response.usage?.input_tokens,
              outputTokens: response.usage?.output_tokens,
              totalTokens: response.usage?.total_tokens,
            },
          };
        },
      });
    } else {
      const strictSchema = config.structuredOutputMode === "chat-json-schema";
      const conversation: ConversationMessage[] = [
        {
          role: "system",
          content: strictSchema
            ? `${input.developer}\n\nReturn only the JSON object required by the response schema.`
            : `${input.developer}\n\n${promptSchema(input.schema)}`,
        },
        { role: "user", content: JSON.stringify(input.data) },
      ];
      result = await askWithRepair({
        schema: input.schema,
        config,
        operation: input.operation,
        conversation,
        ask: async () => {
          const request = {
            model: config.model,
            messages: conversation.filter(
              (message): message is ConversationMessage & { role: "system" | "user" | "assistant" } =>
                message.role !== "developer",
            ),
            response_format: strictSchema
              ? zodResponseFormat(input.schema, input.name)
              : { type: "json_object" as const },
            temperature: 0.2,
            max_tokens: input.maxTokens,
            ...(config.provider === "openrouter"
              ? { provider: { require_parameters: true } }
              : {}),
          };
          const response = await openai.chat.completions.create(request);
          return {
            raw: response.choices[0]?.message.content ?? "",
            finishReason: response.choices[0]?.finish_reason ?? "unknown",
            usage: {
              inputTokens: response.usage?.prompt_tokens,
              outputTokens: response.usage?.completion_tokens,
              totalTokens: response.usage?.total_tokens,
            },
          };
        },
      });
    }

    await recordMiniCourseAiUsage({
      courseId: input.courseId,
      userId: input.userId,
      operation: input.operation,
      status: "SUCCESS",
      durationMs: Date.now() - started,
      usage: result.usage,
    });

    return result.parsed;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    const diagnostic = activeConfig
      ? providerFailureMessage(error, activeConfig)
      : `AI service setup failed: ${publicErrorDetail(error, "")}`;
    await recordMiniCourseAiUsage({
      courseId: input.courseId,
      userId: input.userId,
      operation: input.operation,
      status: "FAILED",
      durationMs: Date.now() - started,
      errorDetail: diagnostic,
    });
    console.error(`[mini-course-ai:${input.operation}]`, error);
    throw new ApiError(503, diagnostic);
  }
}

/** Keeps prompts inside a predictable budget regardless of upload size. */
export function truncateMaterials(
  sources: { label: string; text: string }[],
  perMaterial = 6_000,
  total = 18_000,
): { label: string; text: string }[] {
  return truncateCourseSources(sources, perMaterial, total);
}
