import "server-only";

import { ApiError } from "@/lib/api";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function requireCourseUser() {
  const user = await getAuthenticatedUser();
  if (!user) throw new ApiError(401, "Authentication required.");
  return user;
}

export async function requireOwnedCourse(courseId: string, userId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new ApiError(404, "Course not found.");
  if ((course.ownerId ?? course.teacherId) !== userId) {
    throw new ApiError(403, "You do not have access to this course.");
  }
  return course;
}

export async function requireTeacherOwnedCourse(courseId: string, user: { id: string; role: string }) {
  if (user.role !== "teacher") throw new ApiError(403, "Teacher access required.");
  return requireOwnedCourse(courseId, user.id);
}

export function assertCourseWritesEnabled() {
  if (process.env.COURSE_WRITES_DISABLED === "true") {
    throw new ApiError(503, "Course changes are temporarily disabled for maintenance.");
  }
}
