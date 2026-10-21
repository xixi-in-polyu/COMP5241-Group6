import { redirect } from "next/navigation";

import { getAuthenticatedUser } from "@/lib/auth/session";

import { CreateCourseClient } from "./create-course-client";

export const metadata = { title: "New mini-course" };
export const instant = false;

export default async function CreateMiniCoursePage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/");
  }
  return <CreateCourseClient />;
}
