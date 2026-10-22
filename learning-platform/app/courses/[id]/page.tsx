import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { UnifiedCourseReader } from "@/app/components/unified-course-reader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getOwnedCourse } from "@/lib/courses/queries";

export const instant = false;

export default async function CoursePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/");
  const { id } = await params;
  const course = await getOwnedCourse(user.id, id);
  if (!course) notFound();
  return <>
    <nav className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-5 pt-6 sm:px-8" aria-label="Course preview navigation">
      <Link href="/courses" className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-[#24496f] transition-colors hover:border-[#b9cbdc] hover:bg-[#f7fafc]">
        ← My courses
      </Link>
      <Link href={`/courses/${id}/edit`} className="inline-flex min-h-10 items-center rounded-lg bg-[#193b61] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#244d78]">
        Edit
      </Link>
    </nav>
    <UnifiedCourseReader course={course} materialDownload={(materialId) => `/api/courses/${id}/materials/${materialId}/download`}/>
  </>;
}
