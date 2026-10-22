import { notFound, redirect } from "next/navigation";

import { EditCourseClient } from "@/app/mini-courses/[id]/edit/edit-course-client";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getOwnedCourse } from "@/lib/courses/queries";

export const instant = false;

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/");
  const { id } = await params;
  const course = await getOwnedCourse(user.id, id);
  if (!course) notFound();
  return <EditCourseClient initial={course} />;
}
