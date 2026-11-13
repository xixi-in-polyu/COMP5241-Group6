import "server-only";

import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { zodResponseFormat, zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getAiConfig, getAiProvider } from "@/lib/ai/config";
import { promptSchema } from "@/lib/ai/schema-prompt";
import { difficultySchema, entitySchema, evidenceSchema, getDifficultySpecification, interactiveLabPayloadSchema, objectiveSchema, questionDifficultyRules, questionSchema, questionTypeSchema, validateInteractiveLab, type AssignmentBrief, type InteractiveLabComponentType, type InteractiveLabPayload, type KnowledgeEntity, type Question, type QuestionSlot } from "./domain";
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
    if (config.structuredOutputMode === "responses-json-schema") {
      const response = await client().responses.parse({ model, input: messages, text: { format: zodTextFormat(schema, name) } });
      if (!response.output_parsed) throw new Error(`The provider did not return ${name}.`);
      await finishUsageEvent(event.id, { status: "success", response, inputTokens: response.usage?.input_tokens, outputTokens: response.usage?.output_tokens, totalTokens: response.usage?.total_tokens, providerRequestId: response.id });
      return response.output_parsed;
    }
    const strictSchema = config.structuredOutputMode === "chat-json-schema";
    const chatRequest = {
      model,
      messages: [{ role: "system" as const, content: strictSchema ? `${developer}\n\nReturn only the JSON object required by the response schema.` : `${developer}\n\n${promptSchema(schema)}` }, { role: "user" as const, content: JSON.stringify(data) }],
      response_format: strictSchema ? zodResponseFormat(schema, name) : { type: "json_object" as const },
      temperature: 0.2,
      ...(provider === "openrouter" ? { provider: { require_parameters: true } } : {}),
    };
    const response = await client().chat.completions.create(chatRequest);
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
const regeneratedSchema = z.object({ question: z.object({
  type: questionTypeSchema,
  objective: objectiveSchema,
  difficulty: difficultySchema,
  score: z.number().int().min(1).max(100),
  prompt: z.string().min(1),
  options: z.array(z.string()),
  answer: z.string().min(1),
  explanation: z.string().min(1),
  evidenceRefs: z.array(z.string().uuid()).min(1),
}) });

export function validateGroundedQuestion(question: Question, slot: QuestionSlot, entities: KnowledgeEntity[], segments: Segment[]) {
  const errors: string[] = [];
  if (question.type !== slot.type || question.objective !== slot.objective || question.difficulty !== slot.difficulty) errors.push("Question does not match its assigned slot.");
  const difficultyRule = questionDifficultyRules[slot.type][slot.difficulty];
  if (!difficultyRule || !difficultyRule.objectives.includes(slot.objective)) errors.push("Question slot uses an incompatible type, objective, and difficulty combination.");
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
  const result = await structured(generatedSchema, "assessment_question", "Generate exactly one English assessment question matching the immutable slot and its explicit difficulty specification. Difficulty must come from cognitive demand, reasoning, transfer, and knowledge integration—not obscure vocabulary, unsupported knowledge, trick wording, or ambiguity. The answer and explanation must be supported by supplied evidence. Copy evidence IDs exactly. Single/multi choice uses option letters as answers; open questions have no options.", { brief, slot, difficultySpecification: getDifficultySpecification(slot), priorErrors, entities: relevant, segments: segments.filter((segment) => relevant.some((entity) => entity.evidence.some((evidence) => evidence.segmentId === segment.id))) }, trace);
  return questionSchema.parse({ ...result.question, id: randomUUID(), origin: "ai_generated", type: slot.type, objective: slot.objective, difficulty: slot.difficulty, entityIds: slot.entityIds, score: slot.score, warnings: [] });
}

export async function regenerateQuestion(current: Question, instruction: string, entities: KnowledgeEntity[], segments: Segment[], trace: Trace, priorErrors: string[] = []) {
  const relevant = entities.filter((entity) => current.entityIds.includes(entity.id));
  const teacherInstruction = instruction.trim() || "Generate a meaningfully different question about the same knowledge. Preserve every property that I have not explicitly asked to change.";
  const developer = [
    "Regenerate the supplied current assessment question according to the teacher instruction.",
    "The teacher instruction is fully editable and may replace the default template. Follow explicit requests to change the question type, difficulty, objective, score, wording, options, or format.",
    "For properties the teacher does not mention, preserve the corresponding current-question property. Unless the teacher requests a minor edit, produce a meaningfully different question rather than a light paraphrase.",
    "If an explicit change makes another property incompatible, adjust only the minimum related properties required to produce a valid assessment question.",
    "The result must be one complete English student-facing assessment question related to the current question and grounded only in the supplied entities and evidence.",
    "Copy evidence IDs exactly. A single-choice answer must be exactly one option letter. A multi-choice answer must be two or more comma-separated option letters. Fill-blank and short-answer questions must have no options.",
    "If the teacher request cannot be supported by the evidence, make the closest supported revision; never invent facts or return commentary instead of a question.",
  ].join(" ");
  const result = await structured(regeneratedSchema, "regenerated_assessment_question", developer, {
    currentQuestion: current,
    teacherInstruction,
    priorErrors,
    entities: relevant,
    segments: segments.filter((segment) => relevant.some((entity) => entity.evidence.some((evidence) => evidence.segmentId === segment.id))),
  }, trace);
  return questionSchema.parse({ ...result.question, id: current.id, origin: "ai_generated", entityIds: current.entityIds, warnings: [] });
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
  const difficultySpecifications = questions.map((question) => ({ questionId: question.id, specification: getDifficultySpecification(question) }));
  const result = await structured(reviewSchema, "quality_review", "Review whether each answer and explanation is grounded in cited evidence and whether the actual cognitive demand matches its difficulty specification. Flag questions that are easier or harder than labeled, use an incompatible task for the question type, rely on ambiguity or obscure wording, contain weak distractors, or require unsupported knowledge. Return only material warnings; do not rewrite questions.", { questions, difficultySpecifications, entities, segments }, trace);
  return result.warnings.map((item) => `${item.questionId}: ${item.warning}`);
}

export { evidenceSchema };
