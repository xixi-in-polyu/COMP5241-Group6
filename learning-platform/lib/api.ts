import { ZodError } from "zod";
import { authorizeApiRole } from "@/lib/auth/authorization";
import { MaterialError } from "@/lib/materials/types";
import { prisma } from "@/lib/prisma";

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export async function requireTeacherApi() {
  const auth = await authorizeApiRole("teacher");
  if (auth.response) throw new ApiError(auth.response.status, auth.response.status === 401 ? "Authentication required." : "Teacher access required.");
  return auth.user;
}

export async function ownedCourse(courseId: string, teacherId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new ApiError(404, "Course not found.");
  if (course.teacherId !== teacherId) throw new ApiError(403, "You do not have access to this course.");
  return course;
}

export async function ownedAssignment(assignmentId: string, teacherId: string) {
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId }, include: { course: true } });
  if (!assignment) throw new ApiError(404, "Assignment not found.");
  if (assignment.course.teacherId !== teacherId) throw new ApiError(403, "You do not have access to this assignment.");
  return assignment;
}

export function apiError(error: unknown) {
  if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof MaterialError) return Response.json({ error: error.message, code: error.code }, { status: 422 });
  if (error instanceof ZodError) return Response.json({ error: "Validation failed.", details: error.issues }, { status: 422 });
  if (error instanceof SyntaxError) return Response.json({ error: "Request body must contain valid JSON." }, { status: 422 });
  console.error(error);
  return Response.json({ error: error instanceof Error ? error.message : "Unexpected server error." }, { status: 500 });
}
