"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";

import { BlockListEditor } from "@/app/components/mini-course/block-list-editor";
import { MaterialsEditor } from "@/app/components/mini-course/materials-editor";
import { Badge, Card } from "@/app/components/mini-course/ui";
import { CourseMaterialsEditor } from "@/app/components/course-materials-editor";
import { BACKGROUNDS, LEVELS } from "@/lib/mini-courses/labels";
import type {
  LearnerBackground,
  CourseBlock as MiniCourseBlock,
  CourseChapter as MiniCourseChapter,
  CourseLevel as MiniCourseLevel,
  CourseResource as MiniCourseResource,
  UnifiedCourse,
} from "@/lib/courses/types";

function blankChapter(index: number): MiniCourseChapter {
  return {
    id: crypto.randomUUID(),
    title: `Chapter ${index + 1}`,
    objectives: [],
    resources: [],
    materials: [],
    blocks: [
      { id: crypto.randomUUID(), type: "heading", text: `Chapter ${index + 1}` },
      { id: crypto.randomUUID(), type: "text", text: "" },
    ],
  };
}

export function EditCourseClient({ initial }: { initial: UnifiedCourse }) {
  const [saved, setSaved] = useState<UnifiedCourse>(initial);
  const [draft, setDraft] = useState<UnifiedCourse>(initial);
  const [busy, setBusy] = useState<"save" | "ai" | "status" | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [shareUrl, setShareUrl] = useState("");

  const dirty = useMemo(
    () => JSON.stringify(saved) !== JSON.stringify(draft),
    [saved, draft],
  );

  function patch(changes: Partial<UnifiedCourse>) {
    setDraft((current) => ({ ...current, ...changes, publicationStatus: "draft" }));
  }

  function patchChapter(index: number, changes: Partial<MiniCourseChapter>) {
    setDraft((current) => ({
      ...current,
      publicationStatus: "draft",
      chapters: current.chapters.map((chapter, i) =>
        i === index ? { ...chapter, ...changes } : chapter,
      ),
    }));
  }

  function moveChapter(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= draft.chapters.length) return;
    const chapters = draft.chapters.slice();
    const [moved] = chapters.splice(index, 1);
    chapters.splice(target, 0, moved);
    patch({ chapters });
  }

  async function persist() {
    const body = {
      title: draft.title,
      description: draft.description,
      subject: draft.subject,
      audience: draft.audience,
      objectives: draft.objectives,
      level: draft.level,
      background: draft.background,
      durationMinutes: draft.durationMinutes,
      language: draft.language,
      resources: draft.resources,
      chapters: draft.chapters.map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        objectives: chapter.objectives,
        resources: chapter.resources,
        blocks: chapter.blocks,
      })),
    };

    const response = await fetch(`/api/courses/${initial.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Could not save the mini-course.");
    }
    const course = data.course as UnifiedCourse;
    setSaved(course);
    setDraft(course);
    return course;
  }

  async function refresh() {
    const response = await fetch(`/api/courses/${initial.id}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not refresh the course.");
    const course = data.course as UnifiedCourse;
    setSaved(course);
    setDraft(course);
  }

  async function save() {
    setBusy("save");
    setError("");
    setMessage("");
    try {
      await persist();
      setMessage("Saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save.");
    } finally {
      setBusy("");
    }
  }

  async function toggleStatus() {
    setBusy("status");
    setError("");
    setMessage("");
    try {
      if (dirty) await persist();
      const publishing = draft.publicationStatus !== "published";
      const response = await fetch(`/api/courses/${initial.id}/publish`, {
        method: publishing ? "POST" : "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not update the publication status.");
      setShareUrl(typeof data.shareUrl === "string" ? data.shareUrl : "");
      await refresh();
      setMessage(publishing ? "Published with a new private share link." : "Moved back to draft. The old link is no longer valid.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update the status.");
    } finally {
      setBusy("");
    }
  }

  async function writeWithAi() {
    setBusy("ai");
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/ai/course-chapters", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          courseId: initial.id,
          language: draft.language,
          title: draft.title,
          subject: draft.subject,
          audience: draft.audience,
          level: draft.level,
          objectives: draft.objectives,
          chapterTopics: draft.chapters.map((chapter) => chapter.title),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "The AI service is not available right now.");
      }

      const generated = data.chapters as {
        title: string;
        sections: { heading: string; body: string }[];
        summary: string;
      }[];

      setDraft((current) => ({
        ...current,
        publicationStatus: "draft",
        chapters: current.chapters.map((chapter, index) => {
          const result = generated[index];
          if (!result) return chapter;
          const blocks: MiniCourseBlock[] = [
            { id: crypto.randomUUID(), type: "heading", text: chapter.title },
            ...result.sections.flatMap((section) => [
              { id: crypto.randomUUID(), type: "heading" as const, text: section.heading },
              { id: crypto.randomUUID(), type: "text" as const, text: section.body },
            ]),
            ...(result.summary
              ? [{ id: crypto.randomUUID(), type: "summary" as const, text: result.summary }]
              : []),
          ];
          return { ...chapter, blocks };
        }),
      }));
      setMessage("Chapter bodies generated. Review them, then save.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not generate chapters.");
    } finally {
      setBusy("");
    }
  }

  function setBlocks(index: number, blocks: MiniCourseBlock[]) {
    patchChapter(index, { blocks });
  }

  function setResources(index: number, resources: MiniCourseResource[]) {
    patchChapter(index, { resources });
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/courses"
            className="text-xs font-medium text-[#6a7c90] hover:text-[#193b61]"
          >
            ← Back to courses
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#142f4d]">
              {draft.title || "Untitled course"}
            </h1>
            <Badge tone={draft.publicationStatus === "published" ? "success" : "warning"}>
              {draft.publicationStatus === "published" ? "Published" : "Draft"}
            </Badge>
            {dirty ? <Badge tone="info">Unsaved changes</Badge> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/courses/${initial.id}`}
            className="inline-flex min-h-8 items-center rounded-lg border border-[#c6d2df] bg-white px-2.5 text-xs font-semibold text-[#193b61] hover:bg-[#f7f9fb]"
          >
            Preview
          </Link>
          <button
            type="button"
            onClick={toggleStatus}
            disabled={busy !== ""}
            className="inline-flex min-h-8 items-center rounded-lg border border-[#c6d2df] bg-white px-2.5 text-xs font-semibold text-[#193b61] hover:bg-[#f7f9fb] disabled:opacity-50"
          >
            {draft.publicationStatus === "published" ? "Unpublish" : "Publish"}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy !== "" || !dirty}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-[#193b61] px-3 text-xs font-semibold text-white disabled:opacity-50"
          >
            {busy === "save" ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
            Save
          </button>
        </div>
      </div>

      {message ? (
        <p className="mt-3 rounded-lg bg-[#e5f2ea] px-3 py-2 text-xs font-medium text-[#1c6b43]">
          {message}
        </p>
      ) : null}
      {shareUrl ? (
        <p className="mt-2 text-xs text-[#24496f]">
          Share link: <a className="font-semibold underline" href={shareUrl}>{shareUrl}</a>
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 rounded-lg bg-[#fdf3f3] px-3 py-2 text-xs text-[#a3232b]">
          {error}
        </p>
      ) : null}

      <Card className="mt-5 p-5">
        <h2 className="text-sm font-semibold text-[#142f4d]">Details</h2>
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-[#193b61]">Title</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={draft.title}
              onChange={(event) => patch({ title: event.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[#193b61]">Summary</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6"
              rows={3}
              value={draft.description}
              onChange={(event) => patch({ description: event.target.value })}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="block">
              <span className="text-xs font-semibold text-[#193b61]">Level</span>
              <select
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm"
                value={draft.level}
                onChange={(event) => patch({ level: event.target.value as MiniCourseLevel })}
              >
                {LEVELS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[#193b61]">Suits</span>
              <select
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm"
                value={draft.background}
                onChange={(event) => patch({ background: event.target.value as LearnerBackground })}
              >
                {BACKGROUNDS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.short}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[#193b61]">Minutes</span>
              <input
                type="number"
                min={5}
                max={600}
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm"
                value={draft.durationMinutes}
                onChange={(event) => patch({ durationMinutes: Number(event.target.value) })}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[#193b61]">Language</span>
              <select
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm"
                value={draft.language}
                onChange={(event) =>
                  patch({ language: event.target.value === "zh" ? "zh" : "en" })
                }
              >
                <option value="en">English</option>
                <option value="zh">中文</option>
              </select>
            </label>
          </div>
        </div>
      </Card>

      <Card className="mt-4 p-5">
        <MaterialsEditor resources={draft.resources} onChange={(resources) => patch({ resources })} />
      </Card>

      <Card className="mt-4 p-5">
        <p className="text-sm font-semibold text-[#142f4d]">Course files</p>
        <p className="mt-1 text-xs leading-5 text-[#6a7c90]">Upload replacement source files and regenerate the course details and chapter outline from the beginning.</p>
        <Link href={`/courses/create?draftId=${initial.id}`} className="mt-3 inline-flex rounded-lg bg-[#193b61] px-3 py-2 text-xs font-semibold text-white">Re-upload and regenerate</Link>
      </Card>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#142f4d]">
          Chapters ({draft.chapters.length})
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={writeWithAi}
            disabled={busy !== "" || draft.chapters.length === 0}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[#c6d2df] bg-white px-2.5 text-xs font-semibold text-[#193b61] hover:bg-[#f7f9fb] disabled:opacity-50"
          >
            {busy === "ai" ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="size-3.5" aria-hidden="true" />
            )}
            Write bodies with AI
          </button>
          <button
            type="button"
            onClick={() => patch({ chapters: [...draft.chapters, blankChapter(draft.chapters.length)] })}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[#c6d2df] bg-white px-2.5 text-xs font-semibold text-[#193b61] hover:bg-[#f7f9fb]"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Add chapter
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-4">
        {draft.chapters.map((chapter, index) => (
          <Card key={chapter.id} className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[#8a99a9]">Ch. {index + 1}</span>
              <input
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium"
                value={chapter.title}
                onChange={(event) => patchChapter(index, { title: event.target.value })}
                aria-label={`Chapter ${index + 1} title`}
              />
              <button
                type="button"
                onClick={() => moveChapter(index, -1)}
                disabled={index === 0}
                className="rounded-lg border border-[#c6d2df] px-2 py-1 text-xs disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveChapter(index, 1)}
                disabled={index === draft.chapters.length - 1}
                className="rounded-lg border border-[#c6d2df] px-2 py-1 text-xs disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() =>
                  patch({ chapters: draft.chapters.filter((_, i) => i !== index) })
                }
                aria-label={`Delete chapter ${index + 1}`}
                className="grid size-8 place-items-center rounded-lg text-[#8a99a9] hover:bg-[#fbeaea] hover:text-[#8c1d24]"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-3">
              <BlockListEditor blocks={chapter.blocks} onChange={(blocks) => setBlocks(index, blocks)} />
            </div>

            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-[#6a7c90]">
                Chapter materials
              </summary>
              <div className="mt-2">
                <MaterialsEditor
                  resources={chapter.resources}
                  onChange={(resources) => setResources(index, resources)}
                  heading="Chapter materials"
                  hint="Shown with this chapter only."
                />
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <CourseMaterialsEditor
                    courseId={initial.id}
                    chapterId={chapter.id}
                    materials={chapter.materials}
                    selectionMaterials={[...draft.materials, ...draft.chapters.flatMap((item) => item.materials)]}
                    ensureCourse={async () => initial.id}
                    onRefresh={async () => refresh()}
                  />
                </div>
              </div>
            </details>
          </Card>
        ))}
      </div>

      {draft.ownerRole === "teacher" ? (
        <Card className="mt-4 p-5">
          <h2 className="text-sm font-semibold text-[#142f4d]">Teacher tools</h2>
          <p className="mt-1 text-xs text-[#6a7c90]">Knowledge and assignments are managed separately and do not change publication status.</p>
          <Link href={`/teacher/courses/${initial.id}`} className="mt-3 inline-flex rounded-lg border border-[#c6d2df] px-3 py-2 text-xs font-semibold text-[#193b61]">Open Knowledge & Assignments</Link>
        </Card>
      ) : null}
    </main>
  );
}
