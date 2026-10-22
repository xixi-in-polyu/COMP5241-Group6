import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { toClientCourse } from "./serialize";
import type { MiniCourse } from "./types";

const COURSE_INCLUDE = {
  chapters: { include: { blocks: true }, orderBy: { ordinal: "asc" } },
} satisfies Prisma.MiniCourseInclude;

export async function listMiniCourses(ownerId: string): Promise<MiniCourse[]> {
  const rows = await prisma.miniCourse.findMany({
    where: { ownerId },
    include: COURSE_INCLUDE,
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((row) => toClientCourse(row));
}

export async function getMiniCourse(ownerId: string, id: string): Promise<MiniCourse | null> {
  const row = await prisma.miniCourse.findFirst({
    where: { id, ownerId },
    include: COURSE_INCLUDE,
  });
  return row ? toClientCourse(row) : null;
}
