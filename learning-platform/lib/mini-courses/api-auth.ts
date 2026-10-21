import "server-only";

import { ApiError } from "@/lib/api";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

/**
 * Mini-courses are shared by teachers and students, so they do not use
 * `requireTeacherApi`. Any signed-in user may own and edit their own courses.
 */
export async function requireMiniCourseUser() {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new ApiError(401, "Authentication required.");
  }
  return user;
}

export async function requireOwnedMiniCourse(courseId: string, ownerId: string) {
  const course = await prisma.miniCourse.findUnique({ where: { id: courseId } });
  if (!course) {
    throw new ApiError(404, "Mini-course not found.");
  }
  if (course.ownerId !== ownerId) {
    throw new ApiError(403, "You do not have access to this mini-course.");
  }
  return course;
}
