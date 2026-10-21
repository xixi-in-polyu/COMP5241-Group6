"use client";

import { Plus, Trash2 } from "lucide-react";

import type { MiniCourseResource } from "@/lib/mini-courses/types";

const KIND_LABELS: Record<MiniCourseResource["kind"], string> = {
  link: "Link",
  video: "Video",
  file: "File",
};

const URL_PLACEHOLDERS: Record<MiniCourseResource["kind"], string> = {
  link: "https://developer.mozilla.org/…",
  video: "https://www.youtube.com/watch?v=…",
  file: "https://example.com/notes.pdf",
};

export function MaterialsEditor({
  resources,
  onChange,
  heading = "Course materials",
  hint = "Optional. Add a video, a file or a link — learners see these above the chapters.",
  showHeading = true,
}: {
  resources: MiniCourseResource[];
  onChange: (next: MiniCourseResource[]) => void;
  heading?: string;
  hint?: string;
  showHeading?: boolean;
}) {
  function add(kind: MiniCourseResource["kind"] = "link") {
    onChange([...resources, { id: crypto.randomUUID(), kind, title: "", url: "" }]);
  }

  function update(id: string, patch: Partial<MiniCourseResource>) {
    onChange(resources.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        {showHeading ? (
          <div>
            <p className="text-sm font-medium text-[#263e58]">{heading}</p>
            <p className="mt-0.5 text-xs leading-5 text-[#6a7c90]">{hint}</p>
          </div>
        ) : null}
        <div className={showHeading ? "flex flex-wrap gap-1.5" : "ml-auto flex flex-wrap gap-1.5"}>
          {(["video", "file", "link"] as const).map((kind) => {
            // Video and file go through object storage, which is not wired up
            // yet: flip this to true once the upload endpoint exists.
            const uploadPending = kind === "video" || kind === "file";
            return (
              <span
                key={kind}
                title={
                  uploadPending
                    ? "Uploading opens a file picker once object storage is configured — add a URL for now."
                    : undefined
                }
              >
                <button
                  type="button"
                  onClick={() => add(kind)}
                  disabled={uploadPending}
                  aria-disabled={uploadPending}
                  className="focus-ring inline-flex min-h-8 items-center gap-1 rounded-lg border border-[#c6d2df] bg-white px-2.5 text-xs font-semibold text-[#193b61] hover:border-[#9fb2c6] hover:bg-[#f7f9fb] disabled:cursor-not-allowed disabled:border-[#e2e8f0] disabled:bg-[#f5f8fb] disabled:text-[#a8b4c2] disabled:hover:border-[#e2e8f0] disabled:hover:bg-[#f5f8fb]"
                >
                  <Plus className="size-3" aria-hidden="true" />
                  {KIND_LABELS[kind]}
                </button>
              </span>
            );
          })}
        </div>
      </div>

      {resources.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#c6d2df] bg-white/60 px-4 py-4 text-center text-xs text-[#8a99a9]">
          No materials yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {resources.map((resource, index) => (
            <li
              key={resource.id}
              className="grid gap-2 rounded-xl border border-[#e2e8f0] bg-[#fbfcfe] p-3 sm:grid-cols-[110px_1fr_1.2fr_auto]"
            >
              <select
                className="h-9 rounded-lg border border-slate-200 px-2 text-xs"
                value={resource.kind}
                onChange={(event) =>
                  update(resource.id, { kind: event.target.value as MiniCourseResource["kind"] })
                }
                aria-label={`Material ${index + 1} kind`}
              >
                {Object.entries(KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                className="h-9 rounded-lg border border-slate-200 px-2 text-sm"
                value={resource.title}
                onChange={(event) => update(resource.id, { title: event.target.value })}
                placeholder="Title"
                aria-label={`Material ${index + 1} title`}
              />
              <input
                className="h-9 rounded-lg border border-slate-200 px-2 text-sm"
                value={resource.url}
                onChange={(event) => update(resource.id, { url: event.target.value })}
                placeholder={URL_PLACEHOLDERS[resource.kind]}
                aria-label={`Material ${index + 1} url`}
              />
              <button
                type="button"
                onClick={() => onChange(resources.filter((item) => item.id !== resource.id))}
                aria-label={`Remove material ${index + 1}`}
                className="focus-ring grid size-9 place-items-center rounded-lg text-[#8a99a9] hover:bg-[#fbeaea] hover:text-[#8c1d24]"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
