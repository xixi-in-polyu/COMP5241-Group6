import { entitySchema, failedSlotsSchema, interactiveLabPayloadSchema, questionsSchema } from "./domain";

export function serializeCourse<T extends { entities?: Array<Record<string, unknown>>; assignments?: Array<Record<string, unknown>> }>(course: T) {
  return {
    ...course,
    entities: course.entities?.map((item) => entitySchema.parse({ ...item, aliases: item.aliases, evidence: item.evidence })),
    assignments: course.assignments?.map(serializeAssignment),
  };
}

export function serializeAssignment<T extends Record<string, unknown>>(assignment: T) {
  const labs = Array.isArray(assignment.interactiveLabs) ? assignment.interactiveLabs as Array<Record<string, unknown>> : undefined;
  return {
    ...assignment,
    questions: questionsSchema.parse(assignment.questions),
    failedSlots: failedSlotsSchema.parse(assignment.failedSlots),
    qualityWarnings: Array.isArray(assignment.qualityWarnings) ? assignment.qualityWarnings : [],
    ...(labs ? { interactiveLabs: labs.map((lab) => ({
      ...lab,
      versions: Array.isArray(lab.versions) ? (lab.versions as Array<Record<string, unknown>>).map((version) => ({ ...version, payload: interactiveLabPayloadSchema.parse(version.payload) })) : [],
    })) } : {}),
  };
}
