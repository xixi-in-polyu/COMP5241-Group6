import "server-only";

import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getAiConfig, getAiProvider } from "@/lib/ai/config";
import { entitySchema, evidenceSchema, interactiveLabPayloadSchema, questionSchema, validateInteractiveLab, type AssignmentBrief, type InteractiveLabComponentType, type InteractiveLabPayload, type KnowledgeEntity, type Question, type QuestionSlot } from "./domain";
import { finishUsageEvent, startUsageEvent } from "./usage";

type Segment = { id: string; materialId: string; locator: unknown; normalizedText: string };
type Trace = { courseId: string; runId?: string; assignmentId?: string; operation: string; attempt?: number };
export type Suggestion = { id: string; label: string; kind: "instruction" | "coverage"; payload: string | string[] };

export { getAiProvider };
export function isAiConfigured() {
  try { return getAiConfig().configured; } catch { return false; }
}

function client() {
  const config = getAiConfig();
  if (!config.configured) throw new Error("AI provider endpoint, API key, and model are not fully configured.");
  return new OpenAI({ apiKey: config.apiKey, baseURL: config.endpoint, maxRetries: 0, defaultHeaders: config.defaultHeaders });
}

async function structured<T>(schema: z.ZodType<T>, name: string, developer: string, data: unknown, trace: Trace): Promise<T> {
  const config = getAiConfig();
  const provider = config.provider;
  const model = config.model;
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
  const candidate = await generateQuestion(slot, { title: "Regeneration", instructions: instruction, count: 1, types: [slot.type], objectives: [slot.objective], difficulty: { easy: slot.difficulty === "easy" ? 100 : 0, medium: slot.difficulty === "medium" ? 100 : 0, hard: slot.difficulty === "hard" ? 100 : 0 }, coverageEntityIds: slot.entityIds, interactiveLab: { enabled: false, instructions: "", componentType: "auto" } }, entities, segments, trace);
  return { ...candidate, id: current.id };
}

export async function generateInteractiveLab(
  instruction: string,
  requestedType: InteractiveLabComponentType,
  entities: KnowledgeEntity[],
  segments: Segment[],
  trace: Trace,
  current: InteractiveLabPayload | null,
  priorErrors: string[] = [],
) {
  const selected = entities.filter((entity) => entity.selected);
  const relevantSegments = segments.filter((segment) => selected.some((entity) => entity.evidence.some((evidence) => evidence.segmentId === segment.id)));
  const developer = [
    "Create exactly one English interactive learning activity from the supplied teacher instruction and grounded course evidence.",
    "Return schemaVersion 1 and exactly one activity. Never emit HTML, JavaScript, URLs, markdown links, formulas, or executable expressions.",
    requestedType === "auto" ? "Choose the single best activity type for the learning goal." : `The activity type must be ${requestedType}.`,
    "Use only supplied entity and evidence IDs. Every factual claim, answer, order, category, pair, and checkpoint explanation must be supported by the cited evidence.",
    "For an update, preserve useful unaffected content and stable IDs unless the instruction requires changing them. Output must be English even when the instruction is not.",
  ].join(" ");
  const payload = await structured(interactiveLabPayloadSchema, "interactive_lab", developer, {
    instruction,
    requestedType,
    current,
    priorErrors,
    entities: selected,
    segments: relevantSegments,
  }, trace);
  const errors = validateInteractiveLab(payload, requestedType, entities);
  if (errors.length) throw new Error(errors.join(" "));
  return payload;
}

const reviewSchema = z.object({ warnings: z.array(z.object({ questionId: z.string().uuid(), warning: z.string() })) });
export async function reviewQuestions(questions: Question[], entities: KnowledgeEntity[], segments: Segment[], trace: Trace) {
  if (!questions.length) return [];
  const result = await structured(reviewSchema, "quality_review", "Review whether each answer and explanation is grounded in cited evidence. Return only material warnings; do not rewrite questions.", { questions, entities, segments }, trace);
  return result.warnings.map((item) => `${item.questionId}: ${item.warning}`);
}

export { evidenceSchema };
