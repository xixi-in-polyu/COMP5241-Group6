"use client";

import Link from "next/link";
import { AccountMenu } from "@/app/components/account-menu";
import { WorkspaceHeader } from "@/app/components/workspace-header";
import { ArrowRight, Clock3, FileText, FlaskConical, Plus } from "lucide-react";

type StudentCourse = { id: string; category: string; title: string; description: string; updated: string };
type StudentAssignment = { id: string; title: string; course: string; labCount: number };

const cardStyle =
  "rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md";

export default function StudentPage({ courses, assignments, student }: { courses: StudentCourse[]; assignments: StudentAssignment[]; student: { id: string; email: string } }) {
  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-800 sm:p-6">
      <div className="mx-auto flex w-full max-w-[1900px] flex-col">
        <WorkspaceHeader homeHref="/student">
          <AccountMenu user={student} />
        </WorkspaceHeader>

        <div className="mt-6 flex items-start gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-8">
            <section
              aria-labelledby="courses-heading"
              className="flex flex-col"
            >
              <div className="mb-3 flex shrink-0 items-center justify-between">
                <h2
                  className="text-xl font-bold tracking-[-0.01em] text-[#193b61]"
                  id="courses-heading"
                >
                  My Courses
                </h2>
              </div>

              <div className="grid auto-rows-[minmax(230px,260px)] grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {courses.map((course) => (
                  <Link
                    className={`${cardStyle} group flex h-full max-h-[260px] min-h-0 flex-col p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61]`}
                    href={`/student/courses/${course.id}`}
                    key={course.id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className="max-w-full truncate rounded-full px-2.5 py-1 text-[11px] font-medium leading-4 text-[#365575]"
                        style={{ backgroundColor: "#edf2f7" }}
                      >
                        {course.category}
                      </span>
                      <span className="grid size-7 shrink-0 place-items-center rounded-full text-[#9bb0c4] transition-colors group-hover:bg-[#edf2f7] group-hover:text-[#24496f]">
                        <ArrowRight
                          aria-hidden="true"
                          className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                        />
                      </span>
                    </div>
                    <h3 className="mt-4 line-clamp-2 text-xl font-semibold leading-7 tracking-[-0.01em] text-[#193b61]">
                      {course.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                      {course.description}
                    </p>
                    <span className="mt-auto flex items-center gap-1.5 pt-4 text-xs text-slate-500">
                      <Clock3 aria-hidden="true" className="size-3.5 shrink-0" />
                      {course.updated}
                    </span>
                  </Link>
                ))}
              </div>
            </section>

            <section
              aria-labelledby="assignments-heading"
              className="flex flex-col"
            >
              <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
                <h2
                  className="text-xl font-bold tracking-[-0.01em] text-[#193b61]"
                  id="assignments-heading"
                >
                  Interactive Labs
                </h2>
                <Link
                  className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-[#193b61] bg-white px-4 text-sm font-semibold text-[#193b61] transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61]"
                  href="/interactive-learning"
                >
                  <FlaskConical aria-hidden="true" className="size-4" />
                  Interactive lab
                </Link>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),360px))] auto-rows-[minmax(140px,180px)] justify-start gap-2">
                {assignments.map((assignment) => (
                  <article
                    className={`${cardStyle} flex h-full max-h-[180px] min-h-0 flex-col items-stretch justify-between gap-3 p-3`}
                    key={assignment.id}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600"
                      >
                        <FileText aria-hidden="true" className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-[#193b61]">
                          {assignment.title}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-xs leading-4 text-slate-500">
                          {assignment.course}
                        </p>
                      </div>
                    </div>
                    <div className="flex w-full items-center justify-between gap-2">
                      <span
                        className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                      >
                        {assignment.labCount} Lab{assignment.labCount === 1 ? "" : "s"}
                      </span>
                      <Link
                        className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-[#24496f] transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61]"
                        href={`/student/assignments/${assignment.id}`}
                      >
                        Start
                        <ArrowRight aria-hidden="true" className="size-3.5" />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <aside className="sticky top-6 flex w-[320px] shrink-0 flex-col sm:w-[360px]">
            <Link
              className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#b8cada] bg-white/40 px-6 py-12 text-center transition-colors hover:border-[#7791aa] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61]"
              href="/courses/create"
            >
              <span className="grid size-14 place-items-center rounded-full bg-[#edf2f7] text-[#587896] transition-transform duration-200 group-hover:scale-105">
                <Plus aria-hidden="true" className="size-7" />
              </span>
              <span className="mt-5 text-lg font-semibold tracking-[-0.01em] text-[#193b61]">
                Create your own mini-course
              </span>
              <span className="mt-1.5 text-sm text-slate-500">
                Upload materials and build a course
              </span>
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}
