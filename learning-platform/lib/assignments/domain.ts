import { z } from "zod";

export const locatorSchema = z.object({
  label: z.string().min(1),
  page: z.number().int().positive().optional(),
  slide: z.number().int().positive().optional(),
  paragraph: z.number().int().positive().optional(),
  startMs: z.number().int().nonnegative().optional(),
  endMs: z.number().int().positive().optional(),
});

export const evidenceSchema = z.object({
  id: z.string().uuid(),
  segmentId: z.string().uuid(),
  materialId: z.string().uuid(),
  sourceName: z.string().min(1),
  locator: z.string().min(1),
  quote: z.string().min(1),
});

export const entitySchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1),
  description: z.string(),
  aliases: z.array(z.string()),
  parentId: z.string().uuid().nullable(),
  importance: z.enum(["core", "supporting", "extension"]),
  selected: z.boolean(),
  evidence: z.array(evidenceSchema).min(1),
});

export const questionTypeSchema = z.enum([
  "single_choice",
  "multi_choice",
  "fill_blank",
  "short_answer",
]);
export const objectiveSchema = z.enum([
  "knowledge",
  "comprehension",
  "application",
  "synthesis",
  "innovation",
]);
export const difficultySchema = z.enum(["easy", "medium", "hard"]);

export const interactiveLabComponentTypeSchema = z.enum([
  "auto",
  "flashcards",
  "matching",
  "ordering",
  "categorization",
  "timeline",
  "slider_explorer",
  "quick_check",
]);

const labText = z.string().trim().min(1).max(600)
  .refine((value) => !/[\r\n]/.test(value), "Student-facing text must be a single paragraph.")
  .refine((value) => !/<[^>]+>/.test(value), "HTML is not allowed.")
  .refine((value) => !/(?:https?:\/\/|www\.)/i.test(value), "URLs are not allowed.")
  .refine((value) => !/(?:```|`[^`]+`)/.test(value), "Code is not allowed.")
  .refine((value) => !/(?:\$\$?[^$]+\$\$?|\\(?:frac|sqrt|sum|int|begin|end)\b)/.test(value), "Formula expressions are not allowed.");
const labId = z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/);
const labGrounding = {
  entityIds: z.array(z.string().uuid()).min(1).max(8),
  evidenceRefs: z.array(z.string().uuid()).min(1).max(16),
};

const flashcardsActivitySchema = z.object({
  type: z.literal("flashcards"), id: labId, title: labText, instructions: labText,
  ...labGrounding,
  cards: z.array(z.object({ id: labId, front: labText, back: labText }).strict()).min(2).max(12),
}).strict();

const matchingActivitySchema = z.object({
  type: z.literal("matching"), id: labId, title: labText, instructions: labText,
  ...labGrounding, hint: labText, explanation: labText,
  pairs: z.array(z.object({ id: labId, left: labText, right: labText }).strict()).min(3).max(8),
}).strict();

const orderingActivitySchema = z.object({
  type: z.literal("ordering"), id: labId, title: labText, instructions: labText,
  ...labGrounding, hint: labText, explanation: labText,
  items: z.array(z.object({ id: labId, label: labText }).strict()).min(3).max(10),
}).strict();

const categorizationActivitySchema = z.object({
  type: z.literal("categorization"), id: labId, title: labText, instructions: labText,
  ...labGrounding, hint: labText, explanation: labText,
  categories: z.array(z.object({ id: labId, label: labText }).strict()).min(2).max(5),
  items: z.array(z.object({ id: labId, label: labText, categoryId: labId }).strict()).min(4).max(15),
}).strict().superRefine((activity, context) => {
  const categoryIds = new Set(activity.categories.map((item) => item.id));
  activity.items.forEach((item, index) => {
    if (!categoryIds.has(item.categoryId)) context.addIssue({ code: "custom", path: ["items", index, "categoryId"], message: "Category item must reference a declared category." });
  });
});

const timelineActivitySchema = z.object({
  type: z.literal("timeline"), id: labId, title: labText, instructions: labText,
  ...labGrounding,
  events: z.array(z.object({ id: labId, label: labText, detail: labText }).strict()).min(3).max(10),
}).strict();

const sliderActivitySchema = z.object({
  type: z.literal("slider_explorer"), id: labId, title: labText, instructions: labText,
  ...labGrounding,
  checkpoints: z.array(z.object({ id: labId, value: z.number().finite(), label: labText, explanation: labText }).strict()).min(3).max(10),
}).strict().superRefine((activity, context) => {
  const values = activity.checkpoints.map((item) => item.value);
  if (new Set(values).size !== values.length) context.addIssue({ code: "custom", path: ["checkpoints"], message: "Slider checkpoint values must be unique." });
});

const quickCheckActivitySchema = z.object({
  type: z.literal("quick_check"), id: labId, title: labText, instructions: labText,
  ...labGrounding,
  questions: z.array(z.object({
    id: labId, prompt: labText,
    options: z.array(z.object({ id: labId, label: labText }).strict()).min(2).max(6),
    correctOptionId: labId, hint: labText, explanation: labText,
  }).strict().superRefine((question, context) => {
    if (!question.options.some((option) => option.id === question.correctOptionId)) context.addIssue({ code: "custom", path: ["correctOptionId"], message: "Correct option must reference a declared option." });
  })).min(1).max(5),
}).strict();

export const interactiveLabActivitySchema = z.discriminatedUnion("type", [
  flashcardsActivitySchema,
  matchingActivitySchema,
  orderingActivitySchema,
  categorizationActivitySchema,
  timelineActivitySchema,
  sliderActivitySchema,
  quickCheckActivitySchema,
]).superRefine((activity, context) => {
  const unique = (values: string[], path: Array<string | number>, label: string) => {
    if (new Set(values).size !== values.length) context.addIssue({ code: "custom", path, message: `${label} must be unique.` });
  };
  unique(activity.entityIds, ["entityIds"], "Entity IDs");
  unique(activity.evidenceRefs, ["evidenceRefs"], "Evidence IDs");
  switch (activity.type) {
    case "flashcards": unique(activity.cards.map((item) => item.id), ["cards"], "Card IDs"); break;
    case "matching":
      unique(activity.pairs.map((item) => item.id), ["pairs"], "Pair IDs");
      unique(activity.pairs.map((item) => item.left.toLowerCase()), ["pairs"], "Pair prompts");
      unique(activity.pairs.map((item) => item.right.toLowerCase()), ["pairs"], "Pair answers");
      break;
    case "ordering": unique(activity.items.map((item) => item.id), ["items"], "Item IDs"); break;
    case "categorization":
      unique(activity.categories.map((item) => item.id), ["categories"], "Category IDs");
      unique(activity.items.map((item) => item.id), ["items"], "Item IDs");
      break;
    case "timeline": unique(activity.events.map((item) => item.id), ["events"], "Event IDs"); break;
    case "slider_explorer": unique(activity.checkpoints.map((item) => item.id), ["checkpoints"], "Checkpoint IDs"); break;
    case "quick_check":
      unique(activity.questions.map((item) => item.id), ["questions"], "Question IDs");
      activity.questions.forEach((question, index) => unique(question.options.map((item) => item.id), ["questions", index, "options"], "Option IDs"));
      break;
  }
});

export const interactiveLabPayloadSchema = z.object({
  schemaVersion: z.literal(1),
  activity: interactiveLabActivitySchema,
}).strict();

export const interactiveLabBriefSchema = z.object({
  enabled: z.boolean().default(false),
  instructions: z.string().trim().max(4_000).default(""),
  componentType: interactiveLabComponentTypeSchema.default("auto"),
}).strict().superRefine((lab, context) => {
  if (lab.enabled && !lab.instructions) context.addIssue({ code: "custom", path: ["instructions"], message: "Interactive Lab instructions are required when enabled." });
});

export const briefSchema = z.object({
  title: z.string().trim().min(1).max(160),
  instructions: z.string().trim().min(1).max(4_000),
  count: z.number().int().min(1).max(20),
  types: z.array(questionTypeSchema).min(1),
  difficulty: z
    .object({
      easy: z.number().int().min(0).max(100),
      medium: z.number().int().min(0).max(100),
      hard: z.number().int().min(0).max(100),
    })
    .refine(
      ({ easy, medium, hard }) => easy + medium + hard === 100,
      "Difficulty percentages must total 100.",
    ),
  objectives: z.array(objectiveSchema).min(1),
  coverageEntityIds: z.array(z.string().uuid()).default([]),
  interactiveLab: interactiveLabBriefSchema.default({ enabled: false, instructions: "", componentType: "auto" }),
});

export const questionSchema = z
  .object({
    id: z.string().uuid(),
    origin: z.enum(["ai_generated", "teacher_authored"]),
    type: questionTypeSchema,
    objective: objectiveSchema,
    difficulty: difficultySchema,
    entityIds: z.array(z.string().uuid()),
    prompt: z.string().trim().min(1),
    options: z.array(z.string().trim().min(1)),
    answer: z.string().trim().min(1),
    explanation: z.string().trim().min(1),
    score: z.number().int().min(1).max(100),
    evidenceRefs: z.array(z.string().uuid()),
    warnings: z.array(z.string()),
  })
  .superRefine((question, context) => {
    if (question.type === "single_choice" && question.options.length < 2) {
      context.addIssue({ code: "custom", path: ["options"], message: "Single choice questions require at least two options." });
    }
    if (question.type === "multi_choice" && question.options.length < 3) {
      context.addIssue({ code: "custom", path: ["options"], message: "Multiple choice questions require at least three options." });
    }
    if (["fill_blank", "short_answer"].includes(question.type) && question.options.length) {
      context.addIssue({ code: "custom", path: ["options"], message: "This question type cannot have options." });
    }
    if (new Set(question.options.map((option) => option.toLowerCase())).size !== question.options.length) {
      context.addIssue({ code: "custom", path: ["options"], message: "Question options must be unique." });
    }
    const letters = question.options.map((_, index) => String.fromCharCode(65 + index));
    if (question.type === "single_choice" && !letters.includes(question.answer.toUpperCase())) {
      context.addIssue({ code: "custom", path: ["answer"], message: "Single choice answers must be one valid option letter." });
    }
    if (question.type === "multi_choice") {
      const answers = question.answer.split(",").map((answer) => answer.trim().toUpperCase()).filter(Boolean);
      if (answers.length < 2 || answers.some((answer) => !letters.includes(answer))) context.addIssue({ code: "custom", path: ["answer"], message: "Multiple choice answers must contain at least two valid option letters." });
    }
    if (question.origin === "ai_generated" && !question.evidenceRefs.length) {
      context.addIssue({ code: "custom", path: ["evidenceRefs"], message: "AI-generated questions require evidence." });
    }
  });

export const failedSlotSchema = z.object({
  index: z.number().int().nonnegative(),
  type: questionTypeSchema,
  objective: objectiveSchema,
  difficulty: difficultySchema,
  entityIds: z.array(z.string().uuid()).min(1),
  score: z.number().int().min(1).max(100),
  reason: z.string().min(1),
});

export const questionsSchema = z.array(questionSchema);
export const failedSlotsSchema = z.array(failedSlotSchema);

export type AssignmentBrief = z.infer<typeof briefSchema>;
export type Question = z.infer<typeof questionSchema>;
export type FailedSlot = z.infer<typeof failedSlotSchema>;
export type KnowledgeEntity = z.infer<typeof entitySchema>;
export type QuestionType = z.infer<typeof questionTypeSchema>;
export type Objective = z.infer<typeof objectiveSchema>;
export type Difficulty = z.infer<typeof difficultySchema>;
export type InteractiveLabComponentType = z.infer<typeof interactiveLabComponentTypeSchema>;
export type InteractiveLabActivity = z.infer<typeof interactiveLabActivitySchema>;
export type InteractiveLabPayload = z.infer<typeof interactiveLabPayloadSchema>;
export type InteractiveLabPublicActivity = InteractiveLabActivity extends infer Activity
  ? Activity extends InteractiveLabActivity ? Omit<Activity, "entityIds" | "evidenceRefs"> : never
  : never;
export type InteractiveLabPublicPayload = { schemaVersion: 1; activity: InteractiveLabPublicActivity };

export function validateInteractiveLab(payload: InteractiveLabPayload, requestedType: InteractiveLabComponentType, entities: KnowledgeEntity[]) {
  const errors: string[] = [];
  if (requestedType !== "auto" && payload.activity.type !== requestedType) errors.push(`Activity type must be ${requestedType}.`);
  const entityMap = new Map(entities.filter((entity) => entity.selected).map((entity) => [entity.id, entity]));
  const evidenceOwner = new Map(entities.flatMap((entity) => entity.evidence.map((evidence) => [evidence.id, entity.id] as const)));
  for (const entityId of payload.activity.entityIds) if (!entityMap.has(entityId)) errors.push(`Unknown or unselected entity: ${entityId}`);
  for (const evidenceId of payload.activity.evidenceRefs) {
    const owner = evidenceOwner.get(evidenceId);
    if (!owner || !payload.activity.entityIds.includes(owner)) errors.push(`Evidence ${evidenceId} is not attached to this activity's selected entities.`);
  }
  return [...new Set(errors)];
}

export type QuestionSlot = Omit<FailedSlot, "reason">;

function difficultyCounts(count: number, mix: AssignmentBrief["difficulty"]) {
  const exact = (["easy", "medium", "hard"] as const).map((name) => ({
    name,
    exact: (count * mix[name]) / 100,
    count: Math.floor((count * mix[name]) / 100),
  }));
  let remaining = count - exact.reduce((sum, item) => sum + item.count, 0);
  exact
    .sort((left, right) => (right.exact % 1) - (left.exact % 1))
    .forEach((item) => {
      if (remaining > 0) {
        item.count += 1;
        remaining -= 1;
      }
    });
  return Object.fromEntries(exact.map(({ name, count: value }) => [name, value])) as Record<Difficulty, number>;
}

export function createQuestionSlots(brief: AssignmentBrief, selectedEntityIds: string[]): QuestionSlot[] {
  const coverage = brief.coverageEntityIds.length ? brief.coverageEntityIds : selectedEntityIds;
  if (!coverage.length) throw new Error("Select at least one knowledge entity before generating an assignment.");
  const counts = difficultyCounts(brief.count, brief.difficulty);
  const difficulties = (["easy", "medium", "hard"] as const).flatMap((difficulty) =>
    Array.from({ length: counts[difficulty] }, () => difficulty),
  );
  return Array.from({ length: brief.count }, (_, index) => ({
    index,
    type: brief.types[index % brief.types.length],
    objective: brief.objectives[index % brief.objectives.length],
    difficulty: difficulties[index] ?? "medium",
    entityIds: [coverage[index % coverage.length]],
    score: Math.max(1, Math.floor(100 / brief.count)),
  }));
}

export function validateDraft(questions: unknown, failedSlots: unknown) {
  const parsedQuestions = questionsSchema.safeParse(questions);
  const parsedFailures = failedSlotsSchema.safeParse(failedSlots);
  const errors = [
    ...(parsedQuestions.success ? [] : parsedQuestions.error.issues.map((issue) => `questions.${issue.path.join(".")}: ${issue.message}`)),
    ...(parsedFailures.success ? [] : parsedFailures.error.issues.map((issue) => `failedSlots.${issue.path.join(".")}: ${issue.message}`)),
  ];
  if (parsedFailures.success && parsedFailures.data.length) errors.push("Resolve or delete every failed slot before saving.");
  return { valid: errors.length === 0, errors, questions: parsedQuestions.success ? parsedQuestions.data : null };
}
