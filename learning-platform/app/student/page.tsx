import { requirePageRole } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";

import StudentPageClient from "./student-page-client";

export const instant = false;

export default async function StudentPage() {
  const student = await requirePageRole("student");
  const readyCourses = await prisma.course.findMany({
    where: {
      status: "READY",
      publicationStatus: "PUBLISHED",
      archivedAt: null,
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      category: true,
      description: true,
      updatedAt: true,
    },
  });
  const courses = readyCourses.map((course) => ({ id: course.id, title: course.title, category: course.category || "Course", description: course.description, updated: `Updated ${course.updatedAt.toLocaleDateString()}` }));
  return <StudentPageClient courses={courses} student={{ id: student.id, email: student.email }} />;
}
