import OpenAI from "openai";

import { authorizeApiRole } from "@/lib/auth/authorization";
import { getAiConfig } from "@/lib/ai/config";

const SYSTEM_PROMPT = [
  "You are a patient course teaching assistant helping a student read a course document.",
  "Respond in the language the student uses.",
  "When the document is provided, answer from it and never ask the student to paste sections that are already available.",
  'Cite the page of every fact taken from the document with the marker [pN] — for example: "Group discussion is 5% of the grade [p4]."',
  'Never write a plain reference such as "page 4", "(from page 4)" or "Page 4/5"; always use the [pN] marker instead.',
  "If the document does not cover the question, say so briefly and then answer from general knowledge.",
  "Keep answers focused and concise. Use Markdown: short paragraphs, bullet lists, and tables only when they genuinely help.",
].join(" ");

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isChatMessage(value: unknown): value is ChatMessage {
  return (
    isRecord(value) &&
    (value.role === "user" || value.role === "assistant") &&
    typeof value.content === "string"
  );
}

export async function POST(request: Request) {
  const authorization = await authorizeApiRole("student");

  if (authorization.response) {
    return authorization.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (
    !isRecord(body) ||
    !Array.isArray(body.messages) ||
    body.messages.length === 0 ||
    !body.messages.every(isChatMessage)
  ) {
    return Response.json(
      {
        error:
          "Request body must include a non-empty messages array with user or assistant text messages.",
      },
      { status: 400 },
    );
  }

  let config;
  try {
    config = getAiConfig();
  } catch (error) {
    console.error("Chat API provider configuration is invalid:", error);
    return Response.json({ error: "Chat service is not configured." }, { status: 500 });
  }

  if (!config.configured) {
    console.error("Chat API provider endpoint, API key, or model is missing.");
    return Response.json(
      { error: "Chat service is not configured." },
      { status: 500 },
    );
  }

  const context = typeof body.context === "string" ? body.context.trim().slice(0, 80_000) : "";

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.endpoint,
    defaultHeaders: config.defaultHeaders,
    // Free models can queue for a long time; fail fast enough for the student
    // to see an error and retry instead of waiting indefinitely.
    timeout: 60_000,
    maxRetries: 1,
  });

  try {
    const stream = await client.chat.completions.create({
      model: config.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...(context
          ? [{
              role: "system" as const,
              content: `以下是课程文档内容，[Page N] 表示第 N 页：\n\n${context}`,
            }]
          : []),
        ...body.messages,
      ],
      stream: true,
      max_tokens: 1_200,
      temperature: 0.2,
    });

    const encoder = new TextEncoder();
    const streamBody = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
              controller.enqueue(encoder.encode(`${JSON.stringify({ delta })}\n`));
            }
          }
          controller.enqueue(encoder.encode(`${JSON.stringify({ done: true })}\n`));
        } catch (error) {
          console.error("Chat completion stream failed:", error);
          controller.enqueue(
            encoder.encode(`${JSON.stringify({ error: "Chat service request failed." })}\n`),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(streamBody, {
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-store, no-transform",
        "x-accel-buffering": "no",
      },
    });
  } catch (error) {
    console.error("Chat completion request failed:", error);
    return Response.json(
      { error: "Chat service request failed." },
      { status: 502 },
    );
  }
}
