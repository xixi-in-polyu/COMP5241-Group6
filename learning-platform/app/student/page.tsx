import { requirePageRole } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";

import StudentPageClient from "./student-page-client";

export const instant = false;

export default async function StudentPage() {
  const student = await requirePageRole("student");
  const readyCourses = await prisma.course.findMany({ where: { status: "READY" }, orderBy: { updatedAt: "desc" }, select: { id: true, title: true, category: true, description: true, updatedAt: true, assignments: { where: { status: "SUBMITTED" }, orderBy: { submittedAt: "desc" }, select: { id: true, title: true, submittedAt: true, interactiveLabs: { where: { archivedAt: null }, select: { activeVersionId: true, approvedVersionId: true } } } } } });
  const courses = readyCourses.map((course) => ({ id: course.id, title: course.title, category: course.category || "Course", description: course.description, updated: `Updated ${course.updatedAt.toLocaleDateString()}` }));
  const assignments = readyCourses.flatMap((course) => course.assignments.filter((assignment) => assignment.interactiveLabs.some((lab) => lab.activeVersionId && lab.approvedVersionId === lab.activeVersionId)).map((assignment) => ({ id: assignment.id, title: assignment.title, course: course.title, labCount: assignment.interactiveLabs.filter((lab) => lab.activeVersionId && lab.approvedVersionId === lab.activeVersionId).length })));
  return <StudentPageClient courses={courses} assignments={assignments} student={{ id: student.id, email: student.email }} />;
}
