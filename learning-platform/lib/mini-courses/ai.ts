import "server-only";

import { z } from "zod";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { ApiError } from "@/lib/api";
import { getAiConfig } from "@/lib/ai/config";
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

const NO_API = "The AI service is not available right now. Please try again later.";

export type AiOperation = "course_draft" | "course_chapters";

function client() {
  const config = getAiConfig();
  if (!config.configured) {
    throw new ApiError(503, NO_API);
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

function parseJsonLoose(raw: string): unknown {
  const trimmed = raw.trim();
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

export async function structured<T>(input: {
  schema: z.ZodType<T>;
  name: string;
  developer: string;
  data: unknown;
  maxTokens: number;
  operation: AiOperation;
  userId: string;
  courseId?: string | null;
}): Promise<T> {
  const started = Date.now();

  try {
    const { config, openai } = client();

    const messages = [
      { role: "developer" as const, content: input.developer },
      { role: "user" as const, content: JSON.stringify(input.data) },
    ];

    if (config.provider === "openai") {
      const response = await openai.responses.parse({
        model: config.model,
        input: messages,
        text: { format: zodTextFormat(input.schema, input.name) },
      });
      if (!response.output_parsed) {
        throw new Error(`The provider did not return ${input.name}.`);
      }
      await recordMiniCourseAiUsage({
        courseId: input.courseId ?? null,
        userId: input.userId,
        operation: input.operation,
        status: "SUCCESS",
        durationMs: Date.now() - started,
        usage: {
          inputTokens: response.usage?.input_tokens,
          outputTokens: response.usage?.output_tokens,
          totalTokens: response.usage?.total_tokens,
        },
      });
      return input.schema.parse(response.output_parsed);
    }

    const response = await openai.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: "system",
          content: `${input.developer}\nReturn only JSON matching this schema: ${JSON.stringify(
            z.toJSONSchema(input.schema),          )}`,
        },
        { role: "user", content: JSON.stringify(input.data) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: input.maxTokens,
    });

    const parsed = input.schema.parse(
      parseJsonLoose(response.choices[0]?.message.content ?? ""),
    );

    await recordMiniCourseAiUsage({
      courseId: input.courseId ?? null,
      userId: input.userId,
      operation: input.operation,
      status: "SUCCESS",
      durationMs: Date.now() - started,
      usage: {
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens,
      },
    });

    return parsed;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    await recordMiniCourseAiUsage({
      courseId: input.courseId ?? null,
      userId: input.userId,
      operation: input.operation,
      status: "FAILED",
      durationMs: Date.now() - started,
      errorDetail: error instanceof Error ? error.message : String(error),
    });
    console.error(`[mini-course-ai:${input.operation}]`, error);
    throw new ApiError(503, NO_API);
  }
}

/** Keeps prompts inside a predictable budget regardless of upload size. */
export function truncateMaterials(
  sources: { label: string; text: string }[],
  perMaterial = 6_000,
  total = 18_000,
): { label: string; text: string }[] {
  let budget = total;
  return sources.map((source) => {
    const used = source.text.slice(0, Math.max(0, Math.min(perMaterial, budget)));
    budget -= used.length;
    return { label: source.label, text: used };
  });
}
