import { requirePageRole } from "@/lib/auth/authorization";
import CourseWorkspace from "./course-workspace";

export const instant = false;

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  await requirePageRole("teacher");
  const { courseId } = await params;
  return <CourseWorkspace courseId={courseId}/>;
}
