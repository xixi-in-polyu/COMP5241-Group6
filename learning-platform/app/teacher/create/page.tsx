import { requirePageRole } from "@/lib/auth/authorization";

import CreateCoursePageClient from "./create-course-page-client";

export const instant = false;

export default async function CreateCoursePage() {
  await requirePageRole("teacher");
  return <CreateCoursePageClient />;
}
