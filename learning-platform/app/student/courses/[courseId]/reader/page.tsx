import { BookOpen, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccountMenu } from "@/app/components/account-menu";
import { UnifiedCourseReader } from "@/app/components/unified-course-reader";
import { WorkspaceHeader } from "@/app/components/workspace-header";
import { requirePageRole } from "@/lib/auth/authorization";
import { COURSE_INCLUDE, serializeCourse } from "@/lib/courses/serialize";
import { prisma } from "@/lib/prisma";

import { CourseReader } from "./course-reader";

export const instant = false;

export default async function CourseReaderPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ fileId?: string | string[]; view?: string | string[] }>;
}) {
  const student = await requirePageRole("student");
  const { courseId } = await params;
  const query = await searchParams;
  const requestedFileId = Array.isArray(query.fileId) ? query.fileId[0] : query.fileId;
  const requestedView = Array.isArray(query.view) ? query.view[0] : query.view;
  const courseRow = await prisma.course.findFirst({
    where: {
      id: courseId,
      status: "READY",
      publicationStatus: "PUBLISHED",
      archivedAt: null,
    },
    include: COURSE_INCLUDE,
  });
  if (!courseRow) notFound();

  const course = serializeCourse(courseRow);
  const files = [
    ...course.materials,
    ...course.chapters.flatMap((chapter) => chapter.materials),
  ].filter(
    (material) =>
      material.kind === "file" &&
      (material.status === "ready" || material.status === "download_only"),
  );
  const view = requestedView === "tutor" && files.length > 0 ? "tutor" : "course";
  const readerPath = `/student/courses/${course.id}/reader`;
  const materialDownload = (materialId: string) =>
    `/api/student/courses/${course.id}/materials/${materialId}/download`;

  return (
    <main
      className={`bg-slate-50 p-4 text-slate-800 sm:p-6 ${
        view === "tutor" ? "flex h-screen flex-col overflow-hidden" : "min-h-screen"
      }`}
    >
      <div
        className={`mx-auto w-full max-w-[1280px] ${
          view === "tutor" ? "flex min-h-0 flex-1 flex-col" : ""
        }`}
      >
        <WorkspaceHeader
          breadcrumbs={[
            { href: `/student/courses/${course.id}`, label: course.title },
            { label: "Learn" },
          ]}
          homeHref="/student"
        >
          <AccountMenu user={student} />
        </WorkspaceHeader>

        <div className="mt-4 flex justify-end">
          <nav
            aria-label="Learning view"
            className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
          >
            <Link
              aria-current={view === "course" ? "page" : undefined}
              className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors ${
                view === "course"
                  ? "bg-[#193b61] text-white"
                  : "text-[#24496f] hover:bg-slate-100"
              }`}
              href={`${readerPath}?view=course`}
            >
              <BookOpen aria-hidden="true" className="size-4" />
              Mini-course
            </Link>
            {files.length > 0 ? (
              <Link
                aria-current={view === "tutor" ? "page" : undefined}
                className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors ${
                  view === "tutor"
                    ? "bg-[#193b61] text-white"
                    : "text-[#24496f] hover:bg-slate-100"
                }`}
                href={`${readerPath}?view=tutor${requestedFileId ? `&fileId=${encodeURIComponent(requestedFileId)}` : ""}`}
              >
                <MessageSquareText aria-hidden="true" className="size-4" />
                PDF &amp; AI Tutor
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="inline-flex min-h-9 cursor-not-allowed items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-400"
                title="No course files are available"
              >
                <MessageSquareText aria-hidden="true" className="size-4" />
                PDF &amp; AI Tutor
              </span>
            )}
          </nav>
        </div>

        {view === "tutor" ? (
          <div className="mt-4 flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CourseReader
              courseId={course.id}
              courseTitle={course.title}
              files={files}
              initialFileId={requestedFileId ?? null}
              userId={student.id}
            />
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-100 p-5 shadow-sm sm:p-8">
            <UnifiedCourseReader
              course={course}
              materialDownload={materialDownload}
              showPublicationStatus={false}
            />
          </div>
        )}
      </div>
    </main>
  );
}
