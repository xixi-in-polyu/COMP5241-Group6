import { notFound, redirect } from "next/navigation";

import { getAuthenticatedUser } from "@/lib/auth/session";
import { getCourseByLegacyId, getOwnedCourse } from "@/lib/courses/queries";

export const instant = false;

export default async function LegacyMiniCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/");
  const { id } = await params;
  const direct = await getOwnedCourse(user.id, id);
  if (direct) redirect(`/courses/${direct.id}`);
  const mapped = await getCourseByLegacyId(user.id, id);
  if (!mapped) notFound();
  redirect(`/courses/${mapped.id}`);
}
