import "server-only";

import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { entitySchema, evidenceSchema, questionSchema, type AssignmentBrief, type KnowledgeEntity, type Question, type QuestionSlot } from "./domain";
import { finishUsageEvent, startUsageEvent } from "./usage";

type Segment = { id: string; materialId: string; locator: unknown; normalizedText: string };
type Trace = { courseId: string; runId?: string; assignmentId?: string; operation: string; attempt?: number };
export type Suggestion = { id: string; label: string; kind: "instruction" | "coverage"; payload: string | string[] };

export function getAiProvider() { return process.env.AI_PROVIDER?.toLowerCase() === "deepseek" || (!process.env.OPENAI_API_KEY && process.env.DEEPSEEK_API_KEY) ? "deepseek" : "openai"; }
export function isAiConfigured() { return getAiProvider() === "deepseek" ? Boolean(process.env.DEEPSEEK_API_KEY) : Boolean(process.env.OPENAI_API_KEY); }
const selectedModel = () => getAiProvider() === "deepseek" ? process.env.DEEPSEEK_MODEL || "deepseek-chat" : process.env.OPENAI_MODEL || "gpt-4.1-mini";

function client() {
  const provider = getAiProvider();
  const apiKey = provider === "deepseek" ? process.env.DEEPSEEK_API_KEY : process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error(`${provider === "deepseek" ? "DEEPSEEK_API_KEY" : "OPENAI_API_KEY"} is not configured.`);
  return new OpenAI({ apiKey, maxRetries: 0, ...(provider === "deepseek" ? { baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com" } : {}) });
}

async function structured<T>(schema: z.ZodType<T>, name: string, developer: string, data: unknown, trace: Trace): Promise<T> {
  const provider = getAiProvider();
  const model = selectedModel();
  const messages = [{ role: "developer" as const, content: developer }, { role: "user" as const, content: JSON.stringify(data) }];
  const request = { model, messages, schema: z.toJSONSchema(schema) };
  const event = await startUsageEvent({ ...trace, provider, model, request, attempt: trace.attempt });
  try {
    if (provider === "openai") {
      const response = await client().responses.parse({ model, input: messages, text: { format: zodTextFormat(schema, name) } });
      if (!response.output_parsed) throw new Error(`The provider did not return ${name}.`);
      await finishUsageEvent(event.id, { status: "success", response, inputTokens: response.usage?.input_tokens, outputTokens: response.usage?.output_tokens, totalTokens: response.usage?.total_tokens, providerRequestId: response.id });
      return response.output_parsed;
    }
    const response = await client().chat.completions.create({
      model,
      messages: [{ role: "system", content: `${developer}\nReturn only JSON matching this schema: ${JSON.stringify(z.toJSONSchema(schema))}` }, { role: "user", content: JSON.stringify(data) }],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });
    const parsed = schema.parse(JSON.parse(response.choices[0]?.message.content || ""));
    await finishUsageEvent(event.id, { status: "success", response, inputTokens: response.usage?.prompt_tokens, outputTokens: response.usage?.completion_tokens, totalTokens: response.usage?.total_tokens, providerRequestId: response.id });
    return parsed;
  } catch (error) {
    await finishUsageEvent(event.id, { status: "provider_error", errorCode: String((error as { code?: string }).code || "AI_ERROR"), errorDetail: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

const extractedSchema = z.object({ entities: z.array(z.object({ name: z.string(), aliases: z.array(z.string()), description: z.string(), parentName: z.string().nullable(), importance: z.enum(["core", "supporting", "extension"]), evidence: z.array(z.object({ segmentId: z.string().uuid(), quote: z.string().min(1) })).min(1) })).min(1).max(24) });

export async function extractEntities(segments: Segment[], sourceNames: Map<string, string>, trace: Trace): Promise<KnowledgeEntity[]> {
  const result = await structured(extractedSchema, "knowledge_entities", "Extract a compact hierarchy of teachable entities from only the supplied English source. Evidence quotes must be exact substrings and segment IDs must be copied exactly.", segments.map((item) => ({ id: item.id, text: item.normalizedText })), trace);
  const drafts = result.entities.flatMap((draft) => {
    const evidence = draft.evidence.flatMap((item) => {
      const segment = segments.find((candidate) => candidate.id === item.segmentId);
      if (!segment || !segment.normalizedText.includes(item.quote)) return [];
      return [{ id: randomUUID(), segmentId: segment.id, materialId: segment.materialId, sourceName: sourceNames.get(segment.materialId) || "Source", locator: (segment.locator as { label?: string }).label || "Source", quote: item.quote }];
    });
    return evidence.length ? [{ ...draft, id: randomUUID(), parentId: null, selected: true, evidence }] : [];
  });
  const byName = new Map(drafts.map((item) => [item.name.toLowerCase().trim(), item.id]));
  return drafts.map(({ parentName, ...item }) => entitySchema.parse({ ...item, parentId: parentName ? byName.get(parentName.toLowerCase().trim()) || null : null }));
}

const suggestionsSchema = z.object({ suggestions: z.array(z.discriminatedUnion("kind", [z.object({ kind: z.literal("instruction"), label: z.string(), payload: z.string() }), z.object({ kind: z.literal("coverage"), label: z.string(), payload: z.array(z.string().uuid()) })])).min(1).max(6) });
export async function suggestBrief(instructions: string, entities: KnowledgeEntity[], trace: Trace): Promise<Suggestion[]> {
  const result = await structured(suggestionsSchema, "brief_suggestions", "Suggest independent improvements to assessment instructions or knowledge coverage. Do not change anything automatically. Coverage IDs must come from the input.", { instructions, entities: entities.filter((item) => item.selected).map(({ id, name }) => ({ id, name })) }, trace);
  const valid = new Set(entities.map((item) => item.id));
  return result.suggestions.map((item) => ({ ...item, id: randomUUID(), payload: item.kind === "coverage" ? item.payload.filter((id) => valid.has(id)) : item.payload }));
}

const generatedSchema = z.object({ question: z.object({ prompt: z.string().min(1), options: z.array(z.string()), answer: z.string().min(1), explanation: z.string().min(1), evidenceRefs: z.array(z.string().uuid()).min(1) }) });

export function validateGroundedQuestion(question: Question, slot: QuestionSlot, entities: KnowledgeEntity[], segments: Segment[]) {
  const errors: string[] = [];
  if (question.type !== slot.type || question.objective !== slot.objective || question.difficulty !== slot.difficulty) errors.push("Question does not match its assigned slot.");
  const structural = questionSchema.safeParse(question);
  if (!structural.success) errors.push(...structural.error.issues.map((issue) => issue.message));
  if (new Set(question.options.map((option) => option.trim().toLowerCase())).size !== question.options.length) errors.push("Options must be unique.");
  const letters = question.options.map((_, index) => String.fromCharCode(65 + index));
  if (question.type === "single_choice" && !letters.includes(question.answer.trim().toUpperCase())) errors.push("Single-choice answer must be a valid option letter.");
  if (question.type === "multi_choice" && question.answer.split(",").map((item) => item.trim().toUpperCase()).some((item) => !letters.includes(item))) errors.push("Multi-choice answer must use valid option letters.");
  const evidence = new Map(entities.flatMap((entity) => entity.evidence.map((item) => [item.id, item] as const)));
  const segmentMap = new Map(segments.map((segment) => [segment.id, segment]));
  for (const id of question.evidenceRefs) {
    const item = evidence.get(id);
    if (!item || !question.entityIds.includes(entities.find((entity) => entity.evidence.some((candidate) => candidate.id === id))?.id || "") || !segmentMap.get(item.segmentId)?.normalizedText.includes(item.quote)) errors.push(`Invalid evidence reference: ${id}`);
  }
  return [...new Set(errors)];
}

export async function generateQuestion(slot: QuestionSlot, brief: AssignmentBrief, entities: KnowledgeEntity[], segments: Segment[], trace: Trace, priorErrors: string[] = []): Promise<Question> {
  const relevant = entities.filter((item) => slot.entityIds.includes(item.id));
  const result = await structured(generatedSchema, "assessment_question", "Generate exactly one English assessment question matching the immutable slot. The answer and explanation must be supported by supplied evidence. Copy evidence IDs exactly. Single/multi choice uses option letters as answers; open questions have no options.", { brief, slot, priorErrors, entities: relevant, segments: segments.filter((segment) => relevant.some((entity) => entity.evidence.some((evidence) => evidence.segmentId === segment.id))) }, trace);
  return questionSchema.parse({ ...result.question, id: randomUUID(), origin: "ai_generated", type: slot.type, objective: slot.objective, difficulty: slot.difficulty, entityIds: slot.entityIds, score: slot.score, warnings: [] });
}

export async function regenerateQuestion(current: Question, instruction: string, entities: KnowledgeEntity[], segments: Segment[], trace: Trace) {
  const slot: QuestionSlot = { index: 0, type: current.type, objective: current.objective, difficulty: current.difficulty, entityIds: current.entityIds, score: current.score };
  const candidate = await generateQuestion(slot, { title: "Regeneration", instructions: instruction, count: 1, types: [slot.type], objectives: [slot.objective], difficulty: { easy: slot.difficulty === "easy" ? 100 : 0, medium: slot.difficulty === "medium" ? 100 : 0, hard: slot.difficulty === "hard" ? 100 : 0 }, coverageEntityIds: slot.entityIds }, entities, segments, trace);
  return { ...candidate, id: current.id };
}

const reviewSchema = z.object({ warnings: z.array(z.object({ questionId: z.string().uuid(), warning: z.string() })) });
export async function reviewQuestions(questions: Question[], entities: KnowledgeEntity[], segments: Segment[], trace: Trace) {
  if (!questions.length) return [];
  const result = await structured(reviewSchema, "quality_review", "Review whether each answer and explanation is grounded in cited evidence. Return only material warnings; do not rewrite questions.", { questions, entities, segments }, trace);
  return result.warnings.map((item) => `${item.questionId}: ${item.warning}`);
}

const normalizedTranscriptSchema = z.object({
  segments: z.array(z.object({ id: z.string(), text: z.string().min(1) })),
});

export async function normalizeTranscript(
  segments: Array<{ id: string; text: string }>,
  trace: Trace,
) {
  const result = await structured(
    normalizedTranscriptSchema,
    "normalized_transcript",
    "Correct obvious automatic-caption punctuation and transcription errors without adding facts, deleting meaning, or changing segment IDs. Return every segment exactly once in the original order.",
    { segments },
    trace,
  );
  const byId = new Map(result.segments.map((segment) => [segment.id, segment.text]));
  if (byId.size !== segments.length || segments.some((segment) => !byId.has(segment.id))) {
    throw new Error("Transcript normalization changed the segment set.");
  }
  return segments.map((segment) => ({ ...segment, text: byId.get(segment.id)! }));
}

export { evidenceSchema };
