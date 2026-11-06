"use client";

import { Download, FileText } from "lucide-react";
import { useState } from "react";

import { CourseChat } from "@/app/components/course-chat";

type ReaderFile = { id: string; name: string; size: number; mimeType: string };

export function CourseReader({
  courseId,
  courseTitle,
  files,
  initialFileId,
  userId,
}: {
  courseId: string;
  courseTitle: string;
  files: ReaderFile[];
  initialFileId: string | null;
  userId: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    initialFileId && files.some((file) => file.id === initialFileId) ? initialFileId : files[0]?.id ?? null,
  );
  const [page, setPage] = useState(1);
  const current = files.find((file) => file.id === selectedId) ?? files[0] ?? null;
  const fileUrl = current
    ? `/api/student/courses/${courseId}/materials/${current.id}/download?inline=1`
    : null;
  const downloadUrl = current
    ? `/api/student/courses/${courseId}/materials/${current.id}/download`
    : null;
  const isPdf = current?.mimeType === "application/pdf";

  return (
    <>
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="shrink-0 border-b border-slate-100 px-4 py-4">
          <p className="line-clamp-2 text-sm font-semibold text-[#193b61]">{courseTitle}</p>
        </div>
        <nav aria-label="Course files" className="min-h-0 flex-1 overflow-y-auto p-3">
          <ul className="space-y-2">
            {files.map((file) => {
              const active = file.id === current?.id;
              return (
                <li key={file.id}>
                  <button
                    aria-current={active ? "page" : undefined}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61] ${
                      active
                        ? "border-[#c9d7e4] bg-[#eef2f6]"
                        : "border-slate-200 bg-white hover:border-[#c9d7e4] hover:bg-slate-50"
                    }`}
                    onClick={() => {
                      setSelectedId(file.id);
                      setPage(1);
                    }}
                    type="button"
                  >
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-lg ${
                        active ? "bg-white/80 text-[#284b70]" : "bg-slate-100 text-[#54738f]"
                      }`}
                    >
                      <FileText className="size-4" aria-hidden="true" />
                    </span>
                    <span
                      className={`line-clamp-2 min-w-0 flex-1 break-words text-sm leading-5 ${
                        active ? "font-semibold text-[#193b61]" : "text-slate-700"
                      }`}
                    >
                      {file.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {!files.length ? (
            <p className="px-2 py-6 text-center text-xs text-slate-500">No files in this course yet.</p>
          ) : null}
        </nav>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col bg-slate-100">
        {current && fileUrl ? (
          isPdf ? (
            <iframe
              className="h-full w-full border-0"
              key={`${current.id}-${page}`}
              src={`${fileUrl}#page=${page}`}
              title={current.name}
            />
          ) : (
            <div className="grid h-full place-items-center p-8">
              <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                <FileText className="mx-auto size-8 text-slate-400" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-[#193b61]">{current.name}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  This file type can&apos;t be previewed here. Download it to read the content.
                </p>
                <a
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#193b61] px-3 py-2 text-xs font-semibold text-white"
                  href={downloadUrl ?? fileUrl}
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  Download
                </a>
              </div>
            </div>
          )
        ) : (
          <div className="grid h-full place-items-center p-8 text-sm text-slate-500">
            This course has no files to read yet.
          </div>
        )}
      </section>

      <aside className="flex w-96 shrink-0 flex-col border-l border-slate-200 bg-white">
        {current && fileUrl ? (
          <CourseChat
            key={current.id}
            courseId={courseId}
            fileId={current.id}
            fileName={current.name}
            currentFileUrl={fileUrl}
            onPageChange={setPage}
            userId={userId}
          />
        ) : (
          <p className="grid flex-1 place-items-center p-6 text-center text-sm text-slate-500">
            Select a file to start a chat.
          </p>
        )}
      </aside>
    </>
  );
}
