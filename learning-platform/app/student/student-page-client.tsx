"use client";

import Link from "next/link";
import { AccountMenu } from "@/app/components/account-menu";
import { WorkspaceHeader } from "@/app/components/workspace-header";
import { ArrowRight, AudioLines, Clapperboard, Clock3, FlaskConical, Gamepad2, Plus } from "lucide-react";
import { chipTones, coverFor, CourseCover } from "@/app/components/course-cover";

type StudentCourse = { id: string; category: string; title: string; description: string; updated: string };
const cardStyle =
  "rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md";

const tools: Array<{
  dashed?: boolean;
  description: string;
  href: string;
  icon: typeof AudioLines;
  title: string;
  tone: string;
}> = [
  {
    description: "Listen to a page-by-page explanation of a document.",
    href: "/audio",
    icon: AudioLines,
    title: "Audio explanation",
    tone: "bg-[#d9e9f7] text-[#2d5f8a]",
  },
  {
    description: "Practise requirements, reliability, and code review.",
    href: "/interactive-learning",
    icon: FlaskConical,
    title: "Interactive lab",
    tone: "bg-[#d6efe4] text-[#2f6e56]",
  },
  {
    description: "Upload materials and build a course.",
    dashed: true,
    href: "/courses/create",
    icon: Plus,
    title: "Create your own mini-course",
    tone: "bg-[#fbeec2] text-[#8a6410]",
  },
  {
    description: "Watch the course animation with narration and captions.",
    href: "/animations",
    icon: Clapperboard,
    title: "Course animation",
    tone: "bg-[#e4e7f5] text-[#4f5f96]",
  },
  {
    description: "Play through a one-day SDLC sprint.",
    href: "/student/studio",
    icon: Gamepad2,
    title: "Prototype Studio",
    tone: "bg-[#fbd9d2] text-[#a8452f]",
  },
];

export default function StudentPage({ courses, student }: { courses: StudentCourse[]; student: { id: string; email: string } }) {
  return (
    <main className="flex min-h-screen flex-col bg-slate-50 p-4 text-slate-800 sm:p-6">
      <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col">
        <WorkspaceHeader homeHref="/student">
          <AccountMenu user={student} />
        </WorkspaceHeader>

        <div className="flex flex-1 flex-col justify-center gap-8 pb-15">
          <section aria-labelledby="courses-heading" className="flex flex-col">
            <div className="mb-3 flex shrink-0 items-center justify-between">
              <h2 className="text-[24px] font-bold tracking-[-0.01em] text-[#193b61]" id="courses-heading">
                My Courses
              </h2>
            </div>

            <div className="mt-4 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
              {courses.map((course) => (
                <Link
                  className={`${cardStyle} group flex h-[290px] w-[calc((100%-36px)/4)] min-w-[230px] shrink-0 flex-col overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61]`}
                  href={`/student/courses/${course.id}`}
                  key={course.id}
                >
                  <CourseCover category={course.category} className="h-[100px] shrink-0" title={course.title} />
                  <div className="flex flex-1 flex-col p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-semibold leading-4 ${chipTones[coverFor({ category: course.category, title: course.title }).palette]}`}>
                      {course.category}
                    </span>
                    <span className="grid size-6 shrink-0 place-items-center rounded-full text-[#9bb0c4] transition-colors group-hover:bg-[#edf2f7] group-hover:text-[#24496f]">
                      <ArrowRight
                        aria-hidden="true"
                        className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                      />
                    </span>
                  </div>
                  <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-5 tracking-[-0.01em] text-[#193b61]">
                    {course.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-4 text-slate-500">
                    {course.description}
                  </p>
                  <span className="mt-auto flex items-center gap-1.5 pt-2 text-[11px] text-slate-500">
                    <Clock3 aria-hidden="true" className="size-3.5 shrink-0" />
                    {course.updated}
                  </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section aria-labelledby="tools-heading" className="flex flex-col">
            <div className="mb-3">
              <h2 className="text-[24px] font-bold tracking-[-0.01em] text-[#193b61]" id="tools-heading">
                More to Explore
              </h2>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link
                    className={`group flex h-[160px] items-center gap-3 rounded-2xl p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61] ${
                      tool.dashed
                        ? "border-2 border-dashed border-[#b8cada] bg-white/40 hover:border-[#7791aa] hover:bg-white"
                        : "border border-slate-200 bg-white shadow-sm hover:shadow-md"
                    }`}
                    href={tool.href}
                    key={tool.href}
                  >
                    <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${tool.tone}`}>
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[#193b61]">{tool.title}</span>
                      <span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-500">{tool.description}</span>
                    </span>
                    <ArrowRight
                      aria-hidden="true"
                      className="size-4 shrink-0 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5"
                    />
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
