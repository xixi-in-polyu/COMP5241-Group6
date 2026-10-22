import OpenAI from "openai";
import { z } from "zod";

import { getAiConfig } from "@/lib/ai/config";
import { requirePageRole } from "@/lib/auth/authorization";

const inputSchema = z.object({
  pageText: z.string().min(1).max(30_000),
  pageNumber: z.number().int().positive(),
  pageCount: z.number().int().positive(),
  previousPageText: z.string().max(1_200).default(""),
  nextPageText: z.string().max(1_200).default(""),
});

const outputSchema = z.object({
  explanation: z.string().min(1).max(1_000),
  continuesNextPage: z.boolean(),
});
type Explanation = z.infer<typeof outputSchema>;

function parseResponse(value: string): Explanation {
  const unfenced = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  try {
    return outputSchema.parse(JSON.parse(unfenced));
  } catch {
    return {
      explanation: unfenced.slice(0, 1_000),
      continuesNextPage: false,
    };
  }
}

export async function POST(request: Request) {
  try {
    await requirePageRole("student");
    const input = inputSchema.parse(await request.json());
    const config = getAiConfig();
    if (!config.configured) {
      return Response.json({ error: "The AI provider is not configured." }, { status: 503 });
    }

    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.endpoint,
      maxRetries: 0,
      ...(config.defaultHeaders ? { defaultHeaders: config.defaultHeaders } : {}),
    });
    const response = await client.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: "system",
          content: `You are a kind tutor explaining study material aloud to a student.
Use natural, conversational spoken language, as if speaking face to face.
Explain only the supplied page. Keep it simple and concise, no more than 70 words.
Do not mention that you are an AI. Do not invent facts.
Set continuesNextPage to true only when the page's topic clearly continues into the supplied next-page text.
Return only JSON with exactly: {"explanation":"...","continuesNextPage":true|false}.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            currentPage: input.pageNumber,
            totalPages: input.pageCount,
            pageText: input.pageText,
            previousPageContext: input.previousPageText.slice(-1_200),
            nextPageContext: input.nextPageText.slice(0, 1_200),
          }),
        },
      ],
      temperature: 0.25,
      max_tokens: 1_200,
      reasoning_effort: "low",
    });
    const content = response.choices[0]?.message.content;
    if (!content) {
      console.error("[audio-explain] provider response did not include message content", {
        finishReason: response.choices[0]?.finish_reason,
        model: config.model,
      });
      return Response.json({ error: "The AI provider returned an empty explanation." }, { status: 502 });
    }
    return Response.json(parseResponse(content));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "The page text is invalid." }, { status: 400 });
    }
    console.error("[audio-explain]", error);
    return Response.json({ error: "The page could not be explained right now." }, { status: 502 });
  }
}
