import "server-only";

import { prisma } from "@/lib/prisma";
import { COURSE_INCLUDE, serializeCourse } from "./serialize";

export async function listOwnedCourses(ownerId: string, archived = false) {
  const courses = await prisma.course.findMany({
    where: {
      OR: [{ ownerId }, { ownerId: null, teacherId: ownerId }],
      archivedAt: archived ? { not: null } : null,
    },
    include: COURSE_INCLUDE,
    orderBy: { updatedAt: "desc" },
  });
  return courses.map(serializeCourse);
}

export async function getOwnedCourse(ownerId: string, id: string) {
  const course = await prisma.course.findFirst({
    where: { id, OR: [{ ownerId }, { ownerId: null, teacherId: ownerId }] },
    include: COURSE_INCLUDE,
  });
  return course ? serializeCourse(course) : null;
}

export async function getCourseByLegacyId(ownerId: string, legacyMiniCourseId: string) {
  return prisma.course.findFirst({
    where: {
      legacyMiniCourseId,
      OR: [{ ownerId }, { ownerId: null, teacherId: ownerId }],
    },
    select: { id: true },
  });
}
