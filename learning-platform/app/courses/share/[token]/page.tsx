import { notFound, redirect } from "next/navigation";

import { UnifiedCourseReader } from "@/app/components/unified-course-reader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { hashShareToken } from "@/lib/courses/security";
import { COURSE_INCLUDE, serializeCourse } from "@/lib/courses/serialize";
import { prisma } from "@/lib/prisma";

export const instant = false;

export default async function SharedCoursePage({ params }: { params: Promise<{ token: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/");
  const { token } = await params;
  const row = await prisma.course.findFirst({ where: { shareTokenHash: hashShareToken(token), publicationStatus: "PUBLISHED", archivedAt: null }, include: COURSE_INCLUDE });
  if (!row) notFound();
  return <UnifiedCourseReader course={serializeCourse(row)} materialDownload={(materialId) => `/api/shared-courses/${token}/materials/${materialId}/download`}/>;
}
