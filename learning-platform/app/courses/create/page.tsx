import { redirect } from "next/navigation";

import { getAuthenticatedUser } from "@/lib/auth/session";
import { CreateCourseClient } from "@/app/mini-courses/create/create-course-client";

export const metadata = { title: "Create course" };
export const instant = false;

export default async function CreateCoursePage({ searchParams }: { searchParams: Promise<{ draftId?: string }> }) {
  if (!await getAuthenticatedUser()) redirect("/");
  const { draftId } = await searchParams;
  return <CreateCourseClient initialDraftId={draftId ?? null} />;
}
