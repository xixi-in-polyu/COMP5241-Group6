import { entitySchema, failedSlotsSchema, questionsSchema } from "./domain";

export function serializeCourse<T extends { entities?: Array<Record<string, unknown>>; assignments?: Array<Record<string, unknown>> }>(course: T) {
  return {
    ...course,
    entities: course.entities?.map((item) => entitySchema.parse({ ...item, aliases: item.aliases, evidence: item.evidence })),
    assignments: course.assignments?.map(serializeAssignment),
  };
}

export function serializeAssignment<T extends Record<string, unknown>>(assignment: T) {
  return {
    ...assignment,
    questions: questionsSchema.parse(assignment.questions),
    failedSlots: failedSlotsSchema.parse(assignment.failedSlots),
    qualityWarnings: Array.isArray(assignment.qualityWarnings) ? assignment.qualityWarnings : [],
  };
}
