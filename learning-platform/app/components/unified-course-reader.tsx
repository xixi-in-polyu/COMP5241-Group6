import {
  ArrowUp,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  ListTree,
} from "lucide-react";

import { BlockView } from "@/app/components/mini-course/block-view";
import { MaterialsAutoRefresh } from "@/app/components/materials-auto-refresh";
import type { UnifiedCourse } from "@/lib/courses/types";

export function UnifiedCourseReader({
  course,
  materialDownload,
}: {
  course: UnifiedCourse;
  materialDownload: (materialId: string) => string;
}) {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8" id="course-top">
      <MaterialsAutoRefresh
        active={course.materials.some(
          (material) => material.status === "uploaded" || material.status === "parsing",
        )}
      />
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap gap-2 text-xs font-semibold text-[#54738f]">
          <span className="rounded-full bg-[#eef2f6] px-2.5 py-1">
            {course.publicationStatus}
          </span>
          <span className="rounded-full bg-[#eef2f6] px-2.5 py-1">
            {course.level}
          </span>
          <span className="rounded-full bg-[#eef2f6] px-2.5 py-1">
            {course.subject || "General"}
          </span>
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#142f4d]">
          {course.title}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#53657a]">
          {course.description}
        </p>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-[#6a7c90]">
          <Clock3 className="size-3.5" />
          {course.durationMinutes} min · {course.chapters.length} chapters
        </p>
      </header>

      {course.objectives.length ? (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-[#142f4d]">Learning objectives</h2>
          <ul className="mt-3 grid gap-2 text-sm text-[#53657a] sm:grid-cols-2">
            {course.objectives.map((item) => (
              <li className="flex gap-2" key={item}>
                <span aria-hidden="true" className="text-[#54738f]">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {course.materials.length || course.resources.length ? (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-[#142f4d]">Course materials</h2>
          <ul className="mt-3 space-y-2">
            {course.materials.map((material) => {
              const downloadable = material.status === "ready" || material.status === "download_only";
              return (
                <li
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
                  key={material.id}
                >
                  <FileText className="size-4 text-[#24496f]" />
                  <span className="min-w-0 flex-1 truncate text-sm">{material.name}</span>
                  {downloadable ? (
                    <a
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#24496f]"
                      href={materialDownload(material.id)}
                    >
                      <Download className="size-3.5" />
                      Download
                    </a>
                  ) : material.status === "failed" ? (
                    <span
                      className="text-xs font-semibold text-[#a3232b]"
                      title={material.errorDetail ?? undefined}
                    >
                      Could not process
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-[#6a7c90]">Processing…</span>
                  )}
                </li>
              );
            })}
            {course.resources.map((resource) => (
              <li
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
                key={resource.id}
              >
                <ExternalLink className="size-4 text-[#24496f]" />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {resource.title || resource.url}
                </span>
                <a
                  className="text-xs font-semibold text-[#24496f]"
                  href={resource.url}
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  Open
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#142f4d]">
            <ListTree className="size-4 text-[#54738f]" />
            Course outline
          </h2>
          <nav aria-label="Course chapters" className="mt-3">
            <ol className="space-y-1">
              {course.chapters.map((chapter, index) => (
                <li key={chapter.id}>
                  <a
                    className="group flex items-start gap-3 rounded-xl px-2.5 py-2.5 text-sm text-[#53657a] transition-colors hover:bg-[#eef3f7] hover:text-[#193b61]"
                    href={`#chapter-${chapter.id}`}
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#eef2f6] text-[10px] font-bold text-[#54738f] group-hover:bg-white">
                      {index + 1}
                    </span>
                    <span className="line-clamp-2 pt-0.5 leading-5">{chapter.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <div className="space-y-6">
          {course.chapters.map((chapter, index) => (
            <article
              className="scroll-mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
              id={`chapter-${chapter.id}`}
              key={chapter.id}
            >
              <header className="border-b border-slate-100 pb-5">
                <div className="flex items-start gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#193b61] text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#54738f]">
                      Chapter {index + 1}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-[#142f4d]">
                      {chapter.title}
                    </h2>
                  </div>
                </div>
                {chapter.objectives.length ? (
                  <ul className="mt-4 space-y-1 pl-14 text-xs leading-5 text-[#6a7c90]">
                    {chapter.objectives.map((objective) => (
                      <li key={objective}>• {objective}</li>
                    ))}
                  </ul>
                ) : null}
              </header>

              <div className="mt-5">
                {chapter.blocks.map((block) => (
                  <BlockView block={block} key={block.id} />
                ))}
              </div>

              {chapter.materials.length || chapter.resources.length ? (
                <div className="mt-6 space-y-2 border-t border-slate-100 pt-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#54738f]">
                    Chapter resources
                  </p>
                  {chapter.materials
                    .filter((item) => item.status === "ready" || item.status === "download_only")
                    .map((material) => (
                      <a
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-[#24496f] transition-colors hover:bg-[#eef3f7]"
                        href={materialDownload(material.id)}
                        key={material.id}
                      >
                        <Download className="size-4" />
                        {material.name}
                      </a>
                    ))}
                  {chapter.resources.map((resource) => (
                    <a
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-[#24496f] transition-colors hover:bg-[#eef3f7]"
                      href={resource.url}
                      key={resource.id}
                      rel="noreferrer noopener"
                      target="_blank"
                    >
                      <ExternalLink className="size-4" />
                      {resource.title || resource.url}
                    </a>
                  ))}
                </div>
              ) : null}
            </article>
          ))}

          {!course.chapters.length ? (
            <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
              This course does not have any chapters yet.
            </section>
          ) : null}

          {course.chapters.length ? (
            <a
              className="ml-auto flex w-fit items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-[#24496f] hover:bg-white"
              href="#course-top"
            >
              <ArrowUp className="size-3.5" />
              Back to top
            </a>
          ) : null}
        </div>
      </div>
    </main>
  );
}
