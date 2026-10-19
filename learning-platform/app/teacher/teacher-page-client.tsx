"use client";

import Link from "next/link";
import { BookOpen, UsersRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LogoutButton } from "@/app/components/logout-button";

const courses = [
  {
    category: "Software engineering",
    title: "Foundations of Software Engineering",
    description:
      "Guide students through the principles of planning, building, and maintaining reliable software.",
    progress: 68,
    students: 25,
  },
  {
    category: "Human-computer interaction",
    title: "Designing for People",
    description:
      "Help students use research and thoughtful interaction design to shape useful products.",
    progress: 54,
    students: 31,
  },
  {
    category: "Computer science",
    title: "Data Structures & Algorithms",
    description:
      "Build a practical understanding of the structures that make programs efficient.",
    progress: 82,
    students: 18,
  },
];

const students = [
  {
    name: "张三",
    email: "zhangsan@example.edu",
    progress: 76,
    avatarColor: "bg-[#e8eef5] text-[#284b70]",
  },
  {
    name: "李四",
    email: "lisi@example.edu",
    progress: 61,
    avatarColor: "bg-[#edf1ee] text-[#4f6c5d]",
  },
  {
    name: "王五",
    email: "wangwu@example.edu",
    progress: 43,
    avatarColor: "bg-[#f1edf3] text-[#705b78]",
  },
];

type Course = (typeof courses)[number];

export default function TeacherPage() {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!selectedCourse) {
      openerRef.current?.focus();
      openerRef.current = null;
      return;
    }

    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedCourse(null);
      } else if (event.key === "Tab") {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedCourse]);

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-9 text-slate-800 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-9 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-3xl tracking-[-0.03em] text-[#142f4d] sm:text-[2.125rem]">
              Welcome back, Teacher
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
              Review course progress and see how your students are doing.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <LogoutButton className="inline-flex min-h-11 w-fit shrink-0 items-center justify-center gap-2 rounded-xl border border-[#c7d2de] px-4 text-sm font-semibold text-[#24496f] transition-colors duration-200 hover:border-[#193b61] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61]" />
            <Link
              className="inline-flex min-h-11 w-fit shrink-0 items-center justify-center gap-2 rounded-xl bg-[#193b61] px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#284f77] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61]"
              href="/teacher/create"
            >
              Create New Course
            </Link>
          </div>
        </header>

        <section aria-label="Your courses">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
            {courses.map((course) => (
              <article
                className="flex min-h-[310px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                key={course.title}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-[#edf2f7] text-[#284b70]">
                    <BookOpen aria-hidden="true" className="size-[18px]" />
                  </span>
                  <span className="rounded-full border border-slate-200 px-2.5 py-1 text-right text-xs font-medium text-slate-600">
                    {course.category}
                  </span>
                </div>

                <h2 className="text-lg font-semibold leading-6 text-[#193b61]">
                  {course.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {course.description}
                </p>

                <div className="mt-auto pt-6">
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-600">Average Progress</span>
                    <span className="font-semibold tabular-nums text-[#193b61]">
                      {course.progress}%
                    </span>
                  </div>
                  <div
                    aria-label={`Average student progress: ${course.progress}%`}
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={course.progress}
                    className="h-1.5 overflow-hidden rounded-full bg-slate-100"
                    role="progressbar"
                  >
                    <div
                      className="h-full rounded-full bg-[#54738f]"
                      style={{ width: `${course.progress}%` }}
                    />
                  </div>

                  <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <span className="flex items-center gap-2 text-sm text-slate-600">
                      <UsersRound
                        aria-hidden="true"
                        className="size-4 text-slate-500"
                      />
                      {course.students} Students enrolled
                    </span>
                    <button
                      className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#c7d2de] px-3.5 text-sm font-semibold text-[#24496f] transition-colors duration-200 hover:border-[#193b61] hover:bg-[#f6f8fb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61]"
                      onClick={(event) => {
                        openerRef.current = event.currentTarget;
                        setSelectedCourse(course);
                      }}
                      type="button"
                    >
                      View Students
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      {selectedCourse && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-[2px]"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedCourse(null);
            }
          }}
        >
          <section
            aria-labelledby="students-dialog-title"
            aria-modal="true"
            className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-32px_rgba(15,35,58,0.45)] sm:p-7"
            role="dialog"
          >
            <header className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2
                  className="font-serif text-2xl tracking-[-0.02em] text-[#193b61]"
                  id="students-dialog-title"
                >
                  Students
                </h2>
                <p className="mt-1 text-sm leading-5 text-slate-600">
                  {selectedCourse.title}
                </p>
              </div>
              <button
                aria-label="Close student list"
                className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-[#193b61] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61]"
                onClick={() => setSelectedCourse(null)}
                ref={closeButtonRef}
                type="button"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </header>

            <ul
              aria-label={`Students enrolled in ${selectedCourse.title}`}
              className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200"
            >
              {students.map((student) => (
                <li
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  key={student.email}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className={`grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold ${student.avatarColor}`}
                    >
                      {student.name[0]}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#193b61]">
                        {student.name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {student.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:w-40">
                    <div
                      aria-label={`${student.name}'s progress: ${student.progress}%`}
                      aria-valuemax={100}
                      aria-valuemin={0}
                      aria-valuenow={student.progress}
                      className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100"
                      role="progressbar"
                    >
                      <div
                        className="h-full rounded-full bg-[#54738f]"
                        style={{ width: `${student.progress}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-sm tabular-nums text-slate-600">
                      {student.progress}%
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </main>
  );
}
