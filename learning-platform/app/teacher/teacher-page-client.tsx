"use client";

import Link from "next/link";
import { Archive, BookOpen, Clapperboard, LoaderCircle, Plus, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountMenu } from "@/app/components/account-menu";
import { barTones, chipTones, coverFor } from "@/app/components/course-cover";
import { WorkspaceHeader } from "@/app/components/workspace-header";

type Course = { id: string; title: string; subject: string; description: string; publicationStatus: string; knowledgeStatus: string; archivedAt: string | null; materials: unknown[]; assignmentCount: number };
type Teacher = { id: string; email: string };

function knowledgeLabel(status: string) {
  const words = status.toLowerCase().replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export default function TeacherPage({ teacher }: { teacher: Teacher }) {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [archived, setArchived] = useState(false);
  async function loadCourses(showArchived = archived) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(showArchived ? "/api/courses?scope=archived" : "/api/courses");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load courses.");
      setCourses(body.courses);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load courses.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    fetch("/api/courses").then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load courses.");
      setCourses(body.courses);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load courses."))
      .finally(() => setLoading(false));
  }, []);

  async function changeView(showArchived: boolean) {
    setArchived(showArchived);
    await loadCourses(showArchived);
  }

  async function archiveAction(course: Course) {
    const action = course.archivedAt ? "restore" : "archive";
    const prompt = course.archivedAt
      ? `Restore “${course.title}” as a draft?`
      : `Archive “${course.title}”? It will be hidden from active courses and its share link will stop working.`;
    if (!window.confirm(prompt)) return;
    const response = await fetch(`/api/courses/${course.id}/${action}`, { method: "POST" });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error || `Could not ${action} the course.`);
      return;
    }
    await loadCourses(archived);
  }

  return <main className="min-h-screen bg-slate-50 p-4 text-slate-800 sm:p-6">
    <div className="mx-auto flex w-full max-w-[1280px] flex-col">
      <WorkspaceHeader homeHref="/teacher">
        <div className="flex items-center gap-2">
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#193b61] bg-white px-3 text-sm font-semibold text-[#193b61] transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61]"
            href="/animations"
          >
            <Clapperboard aria-hidden="true" className="size-4" />
            Animation
          </Link>
          <AccountMenu user={teacher} />
        </div>
      </WorkspaceHeader>

      <div className="mt-6 flex items-start gap-4">
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button type="button" onClick={() => void changeView(!archived)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-[#24496f] transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61]">
              <Archive className="size-4"/>{archived ? "Active courses" : "Archived"}
            </button>

            <Link href="/courses/create" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#193b61] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#284f77] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61]">
              <Plus className="size-4"/>Create course
            </Link>
          </div>

          <div className="mt-4 flex flex-col gap-5">
            {loading && <p className="flex items-center gap-2 text-slate-600"><LoaderCircle className="size-4 animate-spin"/>Loading courses…</p>}
            {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
            {!loading && !courses.length && <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><BookOpen className="mx-auto size-8 text-slate-400"/><h2 className="mt-3 font-semibold text-[#193b61]">{archived ? "No archived courses" : "No courses yet"}</h2><p className="mt-1 text-sm text-slate-500">{archived ? "Archived courses will appear here." : "Create a course, upload sources, and build learning content or assignments."}</p></section>}
            <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {courses.map((course) => {
                const { palette } = coverFor({ category: course.subject, title: course.title });
                const published = course.publicationStatus === "published";
                const materialCount = `${course.materials.length} material${course.materials.length === 1 ? "" : "s"}`;
                const assignmentCount = `${course.assignmentCount} assignment${course.assignmentCount === 1 ? "" : "s"}`;

                return (
                  <article
                    key={course.id}
                    className="flex min-h-64 cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-[#7791aa] hover:shadow-md"
                    onClick={(event) => { if ((event.target as HTMLElement).closest("a,button")) return; router.push(`/courses/${course.id}`); }}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); router.push(`/courses/${course.id}`); } }}
                    role="link"
                    tabIndex={0}
                  >
                    <span className={`block h-1.5 w-full ${barTones[palette]}`} />
                    <div className="flex flex-1 flex-col p-6">
                      <div className="flex items-center justify-between">
                        <span className={`grid size-10 place-items-center rounded-xl ${chipTones[palette]}`}>
                          <BookOpen className="size-[18px]"/>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${published ? "bg-[#d6efe4] text-[#2f6e56]" : "bg-[#fbeec2] text-[#8a6410]"}`}>
                            <span className="size-1.5 rounded-full bg-current" />
                            {published ? "Published" : "Draft"}
                          </span>
                          <button type="button" onClick={() => void archiveAction(course)} className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label={course.archivedAt ? "Restore course" : "Archive course"} title={course.archivedAt ? "Restore course" : "Archive course"}>{course.archivedAt ? <RotateCcw className="size-4"/> : <Archive className="size-4"/>}</button>
                        </div>
                      </div>
                      <h2 className="mt-5 text-lg font-semibold text-[#193b61]">{course.title}</h2>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{course.description || "No description provided."}</p>
                      <div className="mt-auto border-t border-slate-100 pt-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`size-1.5 rounded-full ${course.knowledgeStatus === "READY" ? "bg-[#2f6e56]" : "bg-slate-400"}`} />
                            {knowledgeLabel(course.knowledgeStatus)}
                          </span>
                          <span>{materialCount} · {assignmentCount}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {!course.archivedAt ? <>
                            <Link href={`/courses/${course.id}/edit`} className="inline-flex min-h-10 items-center rounded-xl bg-[#193b61] px-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#284f77]">Edit course</Link>
                            <Link href={`/teacher/courses/${course.id}`} className="inline-flex min-h-10 items-center rounded-xl bg-[#eef2f6] px-3.5 text-sm font-semibold text-[#1f3a56] transition-colors hover:bg-[#e2e9f1]">Knowledge &amp; assignments</Link>
                          </> : null}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          </div>
        </section>
      </div>
    </div>
  </main>;
}
