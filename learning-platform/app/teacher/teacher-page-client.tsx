"use client";

import Link from "next/link";
import { BookOpen, LoaderCircle, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { LogoutButton } from "@/app/components/logout-button";

type Course = { id: string; title: string; category: string | null; description: string; status: string; phase: string; _count: { materials: number; assignments: number } };

export default function TeacherPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/courses").then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load courses.");
      setCourses(body.courses);
    }).catch((reason) => setError(reason.message)).finally(() => setLoading(false));
  }, []);

  return <main className="min-h-screen bg-slate-50 px-5 py-9 text-slate-800 sm:px-8 sm:py-12">
    <div className="mx-auto max-w-6xl">
      <header className="mb-9 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="font-serif text-3xl tracking-[-0.03em] text-[#142f4d]">Teacher workspace</h1><p className="mt-2 text-slate-600">Build grounded assignments from your course materials.</p></div>
        <div className="flex gap-3"><Link href="/mini-courses" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[#193b61] bg-white px-5 text-base font-semibold text-[#193b61] shadow-[0_4px_12px_-6px_rgba(25,59,97,0.4)] transition-colors hover:bg-[#f2f6fb]"><BookOpen className="size-5"/>Mini-courses</Link><LogoutButton className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-[#24496f]"/><Link href="/teacher/create" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#193b61] px-4 text-sm font-semibold text-white"><Plus className="size-4"/>Create course</Link></div>
      </header>
      {loading && <p className="flex items-center gap-2 text-slate-600"><LoaderCircle className="size-4 animate-spin"/>Loading courses…</p>}
      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {!loading && !courses.length && <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><BookOpen className="mx-auto size-8 text-slate-400"/><h2 className="mt-3 font-semibold text-[#193b61]">No courses yet</h2><p className="mt-1 text-sm text-slate-500">Create a course workspace, then add sources when you build an assignment.</p></section>}
      <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {courses.map((course) => <Link key={course.id} href={`/teacher/courses/${course.id}`} className="flex min-h-64 flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-[#7791aa] hover:shadow-md">
          <div className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-xl bg-[#edf2f7] text-[#284b70]"><BookOpen className="size-[18px]"/></span><span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600">{course.status.replaceAll("_", " ")}</span></div>
          <h2 className="mt-5 text-lg font-semibold text-[#193b61]">{course.title}</h2><p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{course.description || "No description provided."}</p>
          <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500"><span>{course.phase}</span><span>{course._count.materials} materials · {course._count.assignments} assignments</span></div>
        </Link>)}
      </section>
    </div>
  </main>;
}
