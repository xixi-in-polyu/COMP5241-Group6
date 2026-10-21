import { getAuthenticatedUser } from "@/lib/auth/session";
import { listMiniCourses } from "@/lib/mini-courses/queries";
import { CourseCard } from "@/app/components/mini-course/course-card";
import { Card } from "@/app/components/mini-course/ui";
import { BookOpen, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Mini-courses" };
export const instant = false;

export default async function MiniCoursesPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/");
  }

  const courses = await listMiniCourses(user.id);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
      <header>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#54738f]">
              Mini-courses
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-[#142f4d]">
              Short courses built from your own materials
            </h1>
          </div>
          <Link
            href="/mini-courses/create"
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#193b61] px-5 text-base font-semibold text-white shadow-[0_6px_16px_-6px_rgba(25,59,97,0.55)] transition-colors hover:bg-[#244d78] focus-ring"
          >
            <Plus className="size-5" aria-hidden="true" />
            New mini-course
          </Link>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#53657a]">
          A mini-course is a handful of chapters, each with written sections and its own materials.
          Teachers and students can both create them.
        </p>
      </header>

      {courses.length === 0 ? (
        <Card className="mt-6 p-10 text-center">
          <BookOpen className="mx-auto size-7 text-[#7b91a6]" aria-hidden="true" />
          <p className="mt-3 text-base font-semibold text-[#142f4d]">No mini-courses yet</p>
          <p className="mt-1 text-sm text-[#6a7c90]">
            Create one from a document, a set of links, or an empty outline.
          </p>
          <Link
            href="/mini-courses/create"
            className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#193b61] px-5 text-base font-semibold text-white shadow-[0_6px_16px_-6px_rgba(25,59,97,0.55)] transition-colors hover:bg-[#244d78] focus-ring"
          >
            <Plus className="size-5" aria-hidden="true" />
            Create your first mini-course
          </Link>
        </Card>
      ) : (
        <ul className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <li key={course.id}>
              <CourseCard course={course} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
