import OpenAI from "openai";

import { authorizeApiRole } from "@/lib/auth/authorization";
import { getAiConfig } from "@/lib/ai/config";

const SYSTEM_PROMPT = [
  "You are a friendly, patient course teaching assistant.",
  "Help students understand course concepts clearly and encourage learning.",
  "Respond in the language used by the student.",
  "If you recommend that a student use or create a self-built course (自建课程),",
  "include a citation marker such as [1] at the end of that recommendation.",
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

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.endpoint,
    defaultHeaders: config.defaultHeaders,
  });

  try {
    const completion = await client.chat.completions.create({
      model: config.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...body.messages,
      ],
    });

    const message = completion.choices[0]?.message.content;
    if (typeof message !== "string") {
      console.error("Chat completion returned no text content.");
      return Response.json(
        { error: "Chat service returned no text response." },
        { status: 502 },
      );
    }

    return Response.json({ message });
  } catch (error) {
    console.error("Chat completion request failed:", error);
    return Response.json(
      { error: "Chat service request failed." },
      { status: 502 },
    );
  }
}
