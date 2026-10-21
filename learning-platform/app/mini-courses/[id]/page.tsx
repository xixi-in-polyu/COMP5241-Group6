import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock3, FileText } from "lucide-react";

import { BlockView } from "@/app/components/mini-course/block-view";
import { Badge, Card } from "@/app/components/mini-course/ui";
import { getAuthenticatedUser } from "@/lib/auth/session";
import {
  formatDuration,
  labelForBackground,
  labelForLevel,
  STATUS_LABELS,
} from "@/lib/mini-courses/labels";
import { getMiniCourse } from "@/lib/mini-courses/queries";

export const instant = false;

export default async function MiniCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/");
  }

  const { id } = await params;
  const course = await getMiniCourse(user.id, id);
  if (!course) {
    notFound();
  }

  const materials = course.resources.filter(
    (resource) => resource.title.trim().length > 0 || resource.url.trim().length > 0,
  );

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8">
      <Link
        href="/mini-courses"
        className="focus-ring inline-flex items-center gap-1.5 rounded text-xs font-medium text-[#6a7c90] hover:text-[#193b61]"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Back to mini-courses
      </Link>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={course.status === "published" ? "success" : "warning"}>
            {STATUS_LABELS[course.status]}
          </Badge>
          <Badge tone="info">{labelForLevel(course.level)}</Badge>
          <Badge>{labelForBackground(course.background)}</Badge>
          <Badge>{course.subject || "General"}</Badge>
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-[#142f4d]">
          {course.title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#53657a]">{course.summary}</p>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-[#6a7c90]">
          <Clock3 className="size-3.5" aria-hidden="true" />
          {formatDuration(course.durationMinutes)}
          <span aria-hidden="true">·</span>
          {course.chapters.length} {course.chapters.length === 1 ? "chapter" : "chapters"}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/mini-courses/${course.id}/edit`}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[#193b61] px-3 text-sm font-semibold text-white hover:bg-[#244d78]"
          >
            Edit this mini-course
          </Link>
        </div>
      </header>

      {course.objectives.length > 0 ? (
        <section aria-labelledby="objectives-heading" className="mt-6">
          <h2 id="objectives-heading" className="text-sm font-semibold text-[#142f4d]">
            What you will be able to do
          </h2>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-[#53657a]">
            {course.objectives.map((objective) => (
              <li key={objective} className="flex gap-2">
                <span aria-hidden="true">–</span>
                <span>{objective}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {materials.length > 0 ? (
        <section aria-labelledby="materials-heading" className="mt-6">
          <h2 id="materials-heading" className="text-sm font-semibold text-[#142f4d]">
            Course materials
          </h2>
          <ul className="mt-2 space-y-2">
            {materials.map((resource) => (
              <li key={resource.id}>
                <Card className="flex flex-wrap items-center gap-2 p-3">
                  <FileText className="size-4 text-[#24496f]" aria-hidden="true" />
                  <span className="text-sm text-[#193b61]">{resource.title || resource.url}</span>
                  {resource.url ? (
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="focus-ring ml-auto rounded text-xs font-semibold text-[#24496f] hover:underline"
                    >
                      Open
                    </a>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-8 space-y-8">
        {course.chapters.map((chapter, index) => (
          <article key={chapter.id} aria-labelledby={`chapter-${chapter.id}`}>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#54738f]">
              Chapter {index + 1}
            </p>
            <h2 id={`chapter-${chapter.id}`} className="mt-1 text-lg font-semibold text-[#142f4d]">
              {chapter.title}
            </h2>
            <div className="mt-2">
              {chapter.blocks.map((block) => (
                <BlockView key={block.id} block={block} />
              ))}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
