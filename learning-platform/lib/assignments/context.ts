import "server-only";

import { prisma } from "@/lib/prisma";
import { entitySchema } from "./domain";

export async function loadAssignmentKnowledgeContext(assignmentId: string) {
  const assignment = await prisma.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: {
      entities: true,
      segments: true,
      course: { include: { entities: true, segments: true } },
    },
  });
  const entities = (assignment.entities.length
    ? assignment.entities
    : assignment.course.entities
  ).map((item) =>
    entitySchema.parse({
      ...item,
      aliases: item.aliases,
      evidence: item.evidence,
    }),
  );
  const segments = assignment.entities.length
    ? [...assignment.course.segments, ...assignment.segments]
    : assignment.course.segments;
  return { entities, segments };
}
