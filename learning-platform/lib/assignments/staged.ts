import { randomUUID } from "node:crypto";
import type { KnowledgeEntity } from "./domain";

function key(value: string) {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = key(value);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function uniqueEvidence(values: KnowledgeEntity["evidence"]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = `${value.segmentId}:${key(value.quote)}`;
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

export type AssignmentEntitySnapshot = KnowledgeEntity & {
  sourceCourseEntityId?: string | null;
};

type AssignmentSource = {
  kind: "FILE" | "VIDEO" | "TRANSCRIPT";
  status: "UPLOADED" | "PARSING" | "READY" | "NEEDS_INPUT" | "FAILED";
  size?: number | null;
};

export function validateAssignmentSourceSelection(sources: AssignmentSource[]) {
  const documents = sources.filter((source) =>
    ["FILE", "TRANSCRIPT"].includes(source.kind),
  );
  const videos = sources.filter((source) => source.kind === "VIDEO");
  if (documents.length > 2 || videos.length > 1 || (documents.length && videos.length)) {
    throw new Error("Use up to two documents or one YouTube video, not both.");
  }
  if (
    documents.reduce((total, source) => total + (source.size || 0), 0) >
    20 * 1024 * 1024
  ) {
    throw new Error("Document uploads exceed 20 MiB in total.");
  }
}

export function getAssignmentSourceReadiness(
  sources: AssignmentSource[],
  hasCourseKnowledge: boolean,
) {
  validateAssignmentSourceSelection(sources);
  if (!sources.length) return hasCourseKnowledge ? "ready" : "fix";
  if (sources.some((source) => ["FAILED", "NEEDS_INPUT"].includes(source.status))) {
    return "fix";
  }
  if (sources.some((source) => source.status !== "READY")) return "processing";
  return "ready";
}

export function snapshotCourseEntities(
  entities: KnowledgeEntity[],
  idFactory: () => string = randomUUID,
): AssignmentEntitySnapshot[] {
  const ids = new Map(entities.map((entity) => [entity.id, idFactory()]));
  return entities.map((entity) => ({
    ...entity,
    id: ids.get(entity.id)!,
    parentId: entity.parentId ? ids.get(entity.parentId) || null : null,
    sourceCourseEntityId: entity.id,
    aliases: [...entity.aliases],
    evidence: entity.evidence.map((item) => ({ ...item })),
  }));
}

export function mergeAssignmentEntities(
  snapshots: AssignmentEntitySnapshot[],
  extracted: KnowledgeEntity[],
): AssignmentEntitySnapshot[] {
  const merged = snapshots.map((entity) => ({
    ...entity,
    aliases: [...entity.aliases],
    evidence: entity.evidence.map((item) => ({ ...item })),
  }));
  const byName = new Map(merged.map((entity) => [key(entity.name), entity]));
  const targetIds = new Map<string, string>();

  for (const entity of extracted) {
    const existing = byName.get(key(entity.name));
    if (existing) {
      targetIds.set(entity.id, existing.id);
      existing.aliases = uniqueStrings([...existing.aliases, ...entity.aliases]);
      existing.evidence = uniqueEvidence([...existing.evidence, ...entity.evidence]);
      if (!existing.description.trim() && entity.description.trim()) {
        existing.description = entity.description;
      }
      if (existing.importance !== "core" && entity.importance === "core") {
        existing.importance = "core";
      }
      continue;
    }
    const copy = {
      ...entity,
      sourceCourseEntityId: null,
      aliases: uniqueStrings(entity.aliases),
      evidence: uniqueEvidence(entity.evidence),
    };
    targetIds.set(entity.id, copy.id);
    merged.push(copy);
    byName.set(key(copy.name), copy);
  }

  for (const entity of merged) {
    if (entity.parentId && targetIds.has(entity.parentId)) {
      entity.parentId = targetIds.get(entity.parentId) || null;
    }
  }
  return merged;
}
