"use client";

import { upload } from "@vercel/blob/client";
import { Check, FileText, LoaderCircle, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";

import type { CourseMaterial } from "@/lib/courses/types";

const ACCEPT = ".pdf,.txt,.docx,.pptx";

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((body as { error?: string }).error || "Request failed.");
  return body as T;
}

export function CourseMaterialsEditor({
  courseId,
  chapterId = null,
  materials,
  selectionMaterials = materials,
  showAiSelection = false,
  ensureCourse,
  onRefresh,
}: {
  courseId: string | null;
  chapterId?: string | null;
  materials: CourseMaterial[];
  selectionMaterials?: CourseMaterial[];
  showAiSelection?: boolean;
  ensureCourse: () => Promise<string>;
  onRefresh: (courseId: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedOverride, setSelectedOverride] = useState<Set<string> | null>(null);
  const selected = useMemo(
    () => selectedOverride ?? new Set(selectionMaterials.filter((item) => item.aiSelected).map((item) => item.id)),
    [selectionMaterials, selectedOverride],
  );
  const files = materials.filter((item) => item.kind === "file");
  const allFiles = selectionMaterials.filter((item) => item.kind === "file");
  const ready = selectionMaterials.filter((item) => item.kind === "file" && item.status === "ready");

  async function chooseFiles(list: FileList | null) {
    if (!list?.length || busy) return;
    // FileList is live: clearing the input also empties it. Snapshot the File
    // objects before the first await so the async draft creation cannot lose
    // the user's selection.
    const candidates = Array.from(list);
    setBusy(true);
    setError("");
    try {
      const id = await ensureCourse();
      if (allFiles.length + candidates.length > 20) throw new Error("A course can contain at most 20 files.");
      const uploaded = [];
      for (const file of candidates) {
        const blob = await upload(
          `learning-platform/courses/${id}/${crypto.randomUUID()}/${file.name}`,
          file,
          {
            access: "private",
            handleUploadUrl: "/api/uploads/token",
            clientPayload: JSON.stringify({
              courseId: id,
              contentType: file.type || "text/plain",
              size: file.size,
              chapterId,
            }),
          },
        );
        uploaded.push({
          name: file.name,
          mimeType: file.type || "text/plain",
          size: file.size,
          blobPathname: blob.pathname,
          chapterId,
        });
      }
      await responseJson(await fetch(`/api/courses/${id}/materials`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ materials: uploaded }),
      }));
      setSelectedOverride(null);
      await onRefresh(id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not upload the files.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(materialId: string) {
    if (!courseId || busy) return;
    setBusy(true);
    setError("");
    try {
      await responseJson(await fetch(`/api/courses/${courseId}/materials/${materialId}`, { method: "DELETE" }));
      setSelectedOverride(null);
      await onRefresh(courseId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not remove the material.");
    } finally {
      setBusy(false);
    }
  }

  async function saveSelection() {
    if (!courseId) return;
    setBusy(true);
    setError("");
    try {
      await responseJson(await fetch(`/api/courses/${courseId}/materials`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ materialIds: [...selected] }),
      }));
      setSelectedOverride(null);
      await onRefresh(courseId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save AI sources.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#142f4d]">Uploaded course files</p>
          <p className="mt-1 text-xs leading-5 text-[#6a7c90]">
            PDF, TXT, DOCX or PPTX · 20 files · 20 MiB each · 100 MiB total. Published files are downloadable.
          </p>
        </div>
        <label className={`inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold ${busy ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {busy ? "Uploading…" : "Upload files"}
          <input className="sr-only" type="file" multiple accept={ACCEPT} disabled={busy} onChange={(event) => { void chooseFiles(event.target.files); event.currentTarget.value = ""; }} />
        </label>
      </div>
      {error ? <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p> : null}
      {files.length ? (
        <ul className="mt-3 space-y-2">
          {files.map((material) => (
            <li key={material.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <FileText className="size-4 text-[#54738f]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{material.name}</p>
                <p className="text-xs text-slate-500">{material.status.replaceAll("_", " ")} · {(material.size / 1024 / 1024).toFixed(2)} MiB</p>
                {material.errorDetail ? <p className="mt-1 text-xs text-amber-700">{material.errorDetail}</p> : null}
              </div>
              {material.status === "ready" ? <Check className="size-4 text-emerald-600" /> : null}
              <button type="button" disabled={busy} onClick={() => void remove(material.id)} aria-label={`Remove ${material.name}`} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"><Trash2 className="size-4" /></button>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 rounded-xl border border-dashed p-4 text-center text-xs text-slate-500">No uploaded files yet.</p>}
      {showAiSelection && ready.length > 8 ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-900">Choose up to 8 ready files for AI</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {ready.map((material) => (
              <label key={material.id} className="flex items-center gap-2 text-xs text-amber-950">
                <input
                  type="checkbox"
                  checked={selected.has(material.id)}
                  onChange={(event) => setSelectedOverride(() => {
                    const next = new Set(selected);
                    if (event.target.checked) {
                      if (next.size < 8) next.add(material.id);
                    } else next.delete(material.id);
                    return next;
                  })}
                />
                <span className="truncate">{material.name}</span>
              </label>
            ))}
          </div>
          <button type="button" disabled={busy || selected.size < 1 || selected.size > 8} onClick={() => void saveSelection()} className="mt-3 rounded-lg bg-[#193b61] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Save AI source selection ({selected.size}/8)</button>
        </div>
      ) : null}
    </div>
  );
}
