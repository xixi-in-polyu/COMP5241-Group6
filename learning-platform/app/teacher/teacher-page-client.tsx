"use client";

import Link from "next/link";
import { Archive, BookOpen, LoaderCircle, Plus, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogoutButton } from "@/app/components/logout-button";

type Course = { id: string; title: string; subject: string; description: string; publicationStatus: string; knowledgeStatus: string; archivedAt: string | null; materials: unknown[]; assignmentCount: number };

export default function TeacherPage() {
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

  return <main className="min-h-screen bg-slate-50 px-5 py-9 text-slate-800 sm:px-8 sm:py-12">
    <div className="mx-auto max-w-6xl">
      <header className="mb-9 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="font-serif text-3xl tracking-[-0.03em] text-[#142f4d]">Teacher workspace</h1><p className="mt-2 text-slate-600">Build grounded assignments from your course materials.</p></div>
        <div className="flex gap-3"><button type="button" onClick={() => void changeView(!archived)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-[#24496f]"><Archive className="size-4"/>{archived ? "Active courses" : "Archived"}</button><LogoutButton className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-[#24496f]"/><Link href="/courses/create" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#193b61] px-4 text-sm font-semibold text-white"><Plus className="size-4"/>Create course</Link></div>
      </header>
      {loading && <p className="flex items-center gap-2 text-slate-600"><LoaderCircle className="size-4 animate-spin"/>Loading courses…</p>}
      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {!loading && !courses.length && <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><BookOpen className="mx-auto size-8 text-slate-400"/><h2 className="mt-3 font-semibold text-[#193b61]">{archived ? "No archived courses" : "No courses yet"}</h2><p className="mt-1 text-sm text-slate-500">{archived ? "Archived courses will appear here." : "Create a course, upload sources, and build learning content or assignments."}</p></section>}
      <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {courses.map((course) => <article key={course.id} className="flex min-h-64 cursor-pointer flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-[#7791aa] hover:shadow-md" onClick={(event) => { if ((event.target as HTMLElement).closest("a,button")) return; router.push(`/courses/${course.id}`); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); router.push(`/courses/${course.id}`); } }} role="link" tabIndex={0}>
          <div className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-xl bg-[#edf2f7] text-[#284b70]"><BookOpen className="size-[18px]"/></span><div className="flex items-center gap-1.5"><span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600">{course.publicationStatus}</span><button type="button" onClick={() => void archiveAction(course)} className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label={course.archivedAt ? "Restore course" : "Archive course"} title={course.archivedAt ? "Restore course" : "Archive course"}>{course.archivedAt ? <RotateCcw className="size-4"/> : <Archive className="size-4"/>}</button></div></div>
          <h2 className="mt-5 text-lg font-semibold text-[#193b61]">{course.title}</h2><p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{course.description || "No description provided."}</p>
          <div className="mt-auto border-t border-slate-100 pt-4"><div className="flex items-center justify-between text-xs text-slate-500"><span>{course.knowledgeStatus.replaceAll("_", " ")}</span><span>{course.materials.length} materials · {course.assignmentCount} assignments</span></div><div className="mt-3 flex flex-wrap gap-2">{!course.archivedAt ? <><Link href={`/courses/${course.id}/edit`} className="rounded-lg bg-[#193b61] px-3 py-2 text-xs font-semibold text-white">Edit course</Link><Link href={`/teacher/courses/${course.id}`} className="rounded-lg border px-3 py-2 text-xs font-semibold text-[#193b61]">Knowledge & assignments</Link></> : null}</div></div>
        </article>)}
      </section>
    </div>
  </main>;
}
