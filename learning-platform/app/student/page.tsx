import { requirePageRole } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";

import StudentPageClient from "./student-page-client";

export const instant = false;

export default async function StudentPage() {
  const student = await requirePageRole("student");
  const courseRows = await prisma.course.findMany({
    where: {
      archivedAt: null,
      OR: [
        { ownerId: student.id },
        { ownerId: null, teacherId: student.id },
        { status: "READY", publicationStatus: "PUBLISHED" },
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      ownerId: true,
      teacherId: true,
      title: true,
      category: true,
      description: true,
      publicationStatus: true,
      status: true,
      updatedAt: true,
      owner: { select: { role: true } },
      teacher: { select: { role: true } },
      _count: { select: { chapters: true } },
    },
  });
  const courses = courseRows.flatMap((course) => {
    const courseOwnerId = course.ownerId ?? course.teacherId;
    const isOwn = courseOwnerId === student.id;
    const ownerRole = course.owner?.role ?? course.teacher?.role;
    const isPublishedTeacherCourse = ownerRole === "teacher"
      && course.status === "READY"
      && course.publicationStatus === "PUBLISHED";
    if (!isOwn && !isPublishedTeacherCourse) return [];
    return [{
      id: course.id,
      title: course.title,
      category: course.category || "Course",
      description: course.description,
      updated: `Updated ${course.updatedAt.toLocaleDateString()}`,
      publicationStatus: course.publicationStatus.toLowerCase() as "draft" | "published",
      chapterCount: course._count.chapters,
      source: isOwn ? "student" as const : "teacher" as const,
    }];
  });
  return <StudentPageClient courses={courses} student={{ id: student.id, email: student.email }} />;
}
