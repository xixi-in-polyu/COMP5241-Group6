import { z } from "zod";

export const locatorSchema = z.object({
  label: z.string().min(1),
  page: z.number().int().positive().optional(),
  slide: z.number().int().positive().optional(),
  paragraph: z.number().int().positive().optional(),
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
