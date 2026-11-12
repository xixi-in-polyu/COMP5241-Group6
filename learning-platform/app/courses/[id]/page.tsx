import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageShell } from "@/app/components/page-shell";
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

  return (
    <PageShell
      breadcrumbs={[{ label: course.title }, { label: "Preview" }]}
      homeHref={user.role === "teacher" ? "/teacher" : "/student"}
      user={user}
    >
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex justify-end">
          <Link href={`/courses/${id}/edit`} className="inline-flex min-h-10 items-center rounded-lg bg-[#193b61] px-4 font-semibold text-white transition-colors hover:bg-[#244d78]">
            Edit course
          </Link>
        </div>
        <UnifiedCourseReader course={course} materialDownload={(materialId) => `/api/courses/${id}/materials/${materialId}/download`} />
      </div>
    </PageShell>
  );
}
