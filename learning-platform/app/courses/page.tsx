import { Archive, BookOpen, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { UnifiedCourseCard } from "@/app/components/unified-course-card";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { listOwnedCourses } from "@/lib/courses/queries";

export const metadata = { title: "My courses" };
export const instant = false;

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/");
  if (user.role === "teacher") redirect("/teacher");
  const archived = (await searchParams).view === "archived";
  const courses = await listOwnedCourses(user.id, archived);
  return <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#54738f]">Unified courses</p><h1 className="mt-1 text-3xl font-semibold text-[#142f4d]">{archived ? "Archived courses" : "My courses"}</h1><p className="mt-2 text-sm text-[#53657a]">Build chapters from your materials. Teacher-owned courses can also create grounded assignments.</p></div><div className="flex gap-2"><Link href={archived ? "/courses" : "/courses?view=archived"} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold text-[#193b61]"><Archive className="size-4"/>{archived ? "Active courses" : "Archived"}</Link>{!archived ? <Link href="/courses/create" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#193b61] px-4 text-sm font-semibold text-white"><Plus className="size-4"/>Create course</Link> : null}</div></header>
    {!courses.length ? <section className="mt-6 rounded-2xl border border-dashed bg-white p-10 text-center"><BookOpen className="mx-auto size-8 text-slate-400"/><h2 className="mt-3 font-semibold text-[#193b61]">{archived ? "No archived courses" : "No courses yet"}</h2>{!archived ? <Link href="/courses/create" className="mt-4 inline-flex rounded-lg bg-[#193b61] px-4 py-2 text-sm font-semibold text-white">Create your first course</Link> : null}</section> : <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{courses.map((course) => <UnifiedCourseCard key={course.id} course={course}/>)}</section>}
  </main>;
}
