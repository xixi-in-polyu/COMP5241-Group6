import { notFound } from "next/navigation";

import { AccountMenu } from "@/app/components/account-menu";
import { WorkspaceHeader } from "@/app/components/workspace-header";
import { requirePageRole } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";

import { CourseReader } from "./course-reader";

export const instant = false;

export default async function CourseReaderPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ fileId?: string }>;
}) {
  const student = await requirePageRole("student");
  const { courseId } = await params;
  const { fileId } = await searchParams;
  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      status: "READY",
      publicationStatus: "PUBLISHED",
      archivedAt: null,
    },
    select: {
      id: true,
      title: true,
      materials: {
        where: { kind: "FILE", status: { in: ["READY", "DOWNLOAD_ONLY"] } },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, size: true, mimeType: true },
      },
    },
  });
  if (!course) notFound();

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-slate-50 p-4 text-slate-800 sm:p-6">
      <div className="mx-auto flex min-h-0 w-full max-w-[1900px] flex-1 flex-col">
        <WorkspaceHeader homeHref="/student">
          <AccountMenu user={student} />
        </WorkspaceHeader>

        <div className="mt-4 flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CourseReader
            courseId={course.id}
            courseTitle={course.title}
            files={course.materials}
            initialFileId={fileId ?? null}
            userId={student.id}
          />
        </div>
      </div>
    </main>
  );
}
