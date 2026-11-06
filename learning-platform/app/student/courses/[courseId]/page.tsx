import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Beaker } from "lucide-react";

import { AccountMenu } from "@/app/components/account-menu";
import { WorkspaceHeader } from "@/app/components/workspace-header";
import { requirePageRole } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";

export const instant = false;

export default async function StudentCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const student = await requirePageRole("student");
  const { courseId } = await params;
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
      description: true,
      category: true,
      materials: {
        where: { kind: "FILE", status: { in: ["READY", "DOWNLOAD_ONLY"] } },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, size: true },
      },
      assignments: {
        where: { status: "SUBMITTED" },
        orderBy: { submittedAt: "desc" },
        include: { interactiveLabs: { where: { archivedAt: null } } },
      },
    },
  });
  if (!course) notFound();
  const assignments = course.assignments.filter((assignment) => assignment.interactiveLabs.some((lab) => lab.activeVersionId && lab.approvedVersionId === lab.activeVersionId));
  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-800 sm:p-6">
      <div className="mx-auto w-full max-w-[1900px]">
        <WorkspaceHeader homeHref="/student">
          <AccountMenu user={student} />
        </WorkspaceHeader>

        <div className="mx-auto mt-6 w-full max-w-5xl">
          <header className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#54738f]">{course.category || "Course"}</p>
            <h1 className="mt-2 text-3xl font-semibold text-[#142f4d]">{course.title}</h1>
            <p className="mt-2 text-sm text-slate-600">{course.description}</p>
          </header>

          {course.materials.length ? (
            <section className="mt-8">
              <h2 className="text-xl font-semibold text-[#193b61]">Course materials</h2>
              <div className="mt-4">
                <Link
                  className="group block w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61]"
                  href={`/student/courses/${course.id}/reader`}
                >
                  <div className="relative flex h-44 items-center justify-center bg-[#fdf1c7]">
                    <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold tracking-wide text-slate-700 shadow-sm">
                      Doc chat
                    </span>
                    <span className="grid size-20 place-items-center rounded-[28px] rounded-bl-md bg-white shadow-[0_12px_30px_rgba(15,23,42,0.14)] transition-transform duration-200 group-hover:scale-105">
                      <span className="flex items-center gap-1.5" aria-hidden="true">
                        <span className="size-2 rounded-full bg-slate-400" />
                        <span className="size-2 rounded-full bg-slate-400" />
                        <span className="size-2 rounded-full bg-slate-400" />
                      </span>
                    </span>
                  </div>
                  <div className="px-5 py-4">
                    <h3 className="text-lg font-semibold tracking-[-0.01em] text-[#142f4d]">Lecture Slides</h3>
                  </div>
                </Link>
              </div>
            </section>
          ) : null}

          <section className="mt-8">
            <h2 className="text-xl font-semibold text-[#193b61]">Interactive Labs</h2>
            <div className="mt-4 grid gap-3">
              {assignments.map((assignment) => (
                <Link key={assignment.id} href={`/student/assignments/${assignment.id}`} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-[#9bb2c8]">
                  <span className="grid size-10 place-items-center rounded-xl bg-[#edf2f7] text-[#284b70]">
                    <Beaker className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-[#193b61]">{assignment.title}</b>
                    <small className="mt-1 block text-slate-500">
                      {assignment.interactiveLabs.filter((lab) => lab.activeVersionId && lab.approvedVersionId === lab.activeVersionId).length} approved Lab(s) · Practice only
                    </small>
                  </span>
                  <ArrowRight className="size-4 text-slate-400" />
                </Link>
              ))}
              {!assignments.length && (
                <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                  No Interactive Labs have been published yet.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
