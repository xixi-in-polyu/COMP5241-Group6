"use client";

import Link from "next/link";
import { AccountMenu } from "@/app/components/account-menu";
import { WorkspaceHeader } from "@/app/components/workspace-header";
import { Archive, ArrowRight, AudioLines, BookOpen, Clapperboard, Clock3, FlaskConical, Gamepad2, Plus } from "lucide-react";
import { barTones, chipTones, coverFor } from "@/app/components/course-cover";
import { useRouter } from "next/navigation";
import { useState } from "react";

type StudentCourse = {
  id: string;
  category: string;
  title: string;
  description: string;
  updated: string;
  publicationStatus: "draft" | "published";
  chapterCount: number;
  source: "student" | "teacher";
};

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
  const router = useRouter();
  const [visibleCourses, setVisibleCourses] = useState(courses);
  const [archiveError, setArchiveError] = useState("");
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const ownCourses = visibleCourses.filter((course) => course.source === "student");
  const teacherCourses = visibleCourses.filter((course) => course.source === "teacher");

  async function archiveCourse(course: StudentCourse) {
    if (!window.confirm(`Archive “${course.title}”? It will be hidden from active courses and its share link will stop working.`)) return;
    setArchivingId(course.id);
    setArchiveError("");
    try {
      const response = await fetch(`/api/courses/${course.id}/archive`, { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Could not archive the course.");
      }
      setVisibleCourses((current) => current.filter((item) => item.id !== course.id));
      router.refresh();
    } catch (reason) {
      setArchiveError(reason instanceof Error ? reason.message : "Could not archive the course.");
    } finally {
      setArchivingId(null);
    }
  }

  function courseCard(course: StudentCourse) {
    const { palette } = coverFor({ category: course.category, title: course.title });
    const own = course.source === "student";
    const href = own ? `/courses/${course.id}` : `/student/courses/${course.id}`;
    const published = course.publicationStatus === "published";
    return (
      <article
        className="flex min-h-64 cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-[#7791aa] hover:shadow-md"
        key={course.id}
        onClick={(event) => { if ((event.target as HTMLElement).closest("a,button")) return; router.push(href); }}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); router.push(href); } }}
        role="link"
        tabIndex={0}
      >
        <span className={`block h-1.5 w-full ${barTones[palette]}`} />
        <div className="flex flex-1 flex-col p-6">
          <div className="flex items-center justify-between gap-3">
            <span className={`grid size-10 place-items-center rounded-xl ${chipTones[palette]}`}>
              <BookOpen aria-hidden="true" className="size-[18px]" />
            </span>
            <div className="flex items-center gap-1.5">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${published ? "bg-[#d6efe4] text-[#2f6e56]" : "bg-[#fbeec2] text-[#8a6410]"}`}>
                <span className="size-1.5 rounded-full bg-current" />
                {published ? "Published" : "Draft"}
              </span>
              {own ? (
                <button
                  aria-label={`Archive ${course.title}`}
                  className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                  disabled={archivingId === course.id}
                  onClick={() => void archiveCourse(course)}
                  title="Archive course"
                  type="button"
                >
                  <Archive className="size-4" />
                </button>
              ) : null}
            </div>
          </div>
          <span className={`mt-5 w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${chipTones[palette]}`}>{course.category}</span>
          <h3 className="mt-3 text-lg font-semibold text-[#193b61]">{course.title}</h3>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{course.description || "No description provided."}</p>
          <div className="mt-auto border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5"><Clock3 aria-hidden="true" className="size-3.5" />{course.updated}</span>
              <span>{course.chapterCount} chapter{course.chapterCount === 1 ? "" : "s"}</span>
            </div>
            <div className="mt-3">
              <Link className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#193b61] px-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#284f77]" href={own ? `/courses/${course.id}/edit` : href}>
                {own ? "Edit course" : "Open course"}<ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-50 p-4 text-slate-800 sm:p-6">
      <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col">
        <WorkspaceHeader homeHref="/student">
          <AccountMenu user={student} />
        </WorkspaceHeader>

        <div className="flex flex-1 flex-col justify-center gap-8 pb-15">
          <section aria-labelledby="courses-heading" className="flex flex-col">
            <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
              <h2 className="text-[24px] font-bold tracking-[-0.01em] text-[#193b61]" id="courses-heading">
                My mini-courses
              </h2>
              <div className="flex items-center gap-2">
                <Link className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-[#24496f] hover:bg-slate-50" href="/courses?view=archived"><Archive className="size-4" />Archived</Link>
                <Link className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#193b61] px-3 text-sm font-semibold text-white hover:bg-[#284f77]" href="/courses/create"><Plus className="size-4" />Create course</Link>
              </div>
            </div>
            {archiveError ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{archiveError}</p> : null}
            {ownCourses.length ? <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">{ownCourses.map(courseCard)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><BookOpen className="mx-auto size-8 text-slate-400"/><p className="mt-3 text-sm text-slate-500">You have not created a mini-course yet.</p></div>}
          </section>

          <section aria-labelledby="teacher-courses-heading" className="flex flex-col">
            <h2 className="text-[24px] font-bold tracking-[-0.01em] text-[#193b61]" id="teacher-courses-heading">Teacher-published courses</h2>
            {teacherCourses.length ? <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">{teacherCourses.map(courseCard)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><BookOpen className="mx-auto size-8 text-slate-400"/><p className="mt-3 text-sm text-slate-500">No teacher-published courses are available yet.</p></div>}
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
