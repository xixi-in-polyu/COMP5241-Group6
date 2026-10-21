import { notFound, redirect } from "next/navigation";

import { getAuthenticatedUser } from "@/lib/auth/session";
import { getMiniCourse } from "@/lib/mini-courses/queries";

import { EditCourseClient } from "./edit-course-client";

export const instant = false;

export default async function EditMiniCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/");
  }

  const { id } = await params;
  const course = await getMiniCourse(user.id, id);
  if (!course) {
    notFound();
  }

  return <EditCourseClient initial={course} />;
}
