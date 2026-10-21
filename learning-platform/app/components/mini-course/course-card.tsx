"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock3, Eye, Layers, Loader2, PencilLine, Send, Trash2, Undo2 } from "lucide-react";

import {
  formatDuration,
  labelForLevel,
  shortLabelForBackground,
  STATUS_LABELS,
} from "@/lib/mini-courses/labels";
import type { MiniCourse } from "@/lib/mini-courses/types";

import { Badge, Card } from "./ui";

export function CourseCard({ course }: { course: MiniCourse }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "status" | "delete">("");
  const [error, setError] = useState("");
  const isPublished = course.status === "published";

  async function toggleStatus() {
    setBusy("status");
    setError("");
    try {
      const response = await fetch(`/api/mini-courses/${course.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: isPublished ? "draft" : "published" }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Could not update the status.");
      }
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update the status.");
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${course.title}"? This cannot be undone.`)) {
      return;
    }
    setBusy("delete");
    setError("");
    try {
      const response = await fetch(`/api/mini-courses/${course.id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Could not delete the mini-course.");
      }
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete the mini-course.");
      setBusy("");
    }
  }

  return (
    <Card className="flex h-full flex-col p-5">
      <div className="mb-3 flex min-w-0 flex-wrap items-center gap-1.5">
        <Badge tone={isPublished ? "success" : "warning"}>{STATUS_LABELS[course.status]}</Badge>
        <Badge tone="info">{labelForLevel(course.level)}</Badge>
        <Badge>{shortLabelForBackground(course.background)}</Badge>
      </div>

      <h2 className="text-base font-semibold leading-6 text-[#142f4d]">
        <Link href={`/mini-courses/${course.id}/edit`} className="hover:underline">
          {course.title}
        </Link>
      </h2>

      <p className="mt-1.5 line-clamp-3 text-sm leading-6 text-[#53657a]">
        {course.summary || "No description yet."}
      </p>

      <dl className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#6a7c90]">
        <div className="flex items-center gap-1.5">
          <Layers className="size-3.5" aria-hidden="true" />
          <dt className="sr-only">Chapters</dt>
          <dd>
            {course.chapters.length} {course.chapters.length === 1 ? "chapter" : "chapters"}
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock3 className="size-3.5" aria-hidden="true" />
          <dt className="sr-only">Estimated duration</dt>
          <dd>{formatDuration(course.durationMinutes)}</dd>
        </div>
      </dl>

      {error ? (
        <p role="alert" className="mt-3 text-xs font-medium text-[#a3232b]">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#eef2f6] pt-4">
        <Link
          href={`/mini-courses/${course.id}/edit`}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[#193b61] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#244d78]"
        >
          <PencilLine className="size-3.5" aria-hidden="true" />
          Edit
        </Link>
        <Link
          href={`/mini-courses/${course.id}`}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#c6d2df] bg-white px-3 text-[13px] font-semibold text-[#193b61] transition-colors hover:border-[#9fb2c6] hover:bg-[#f7f9fb]"
        >
          <Eye className="size-3.5" aria-hidden="true" />
          Preview
        </Link>
        <button
          type="button"
          onClick={toggleStatus}
          disabled={busy !== ""}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl px-2 text-[13px] font-semibold text-[#24496f] hover:bg-[#eef2f6] disabled:opacity-50"
        >
          {busy === "status" ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : isPublished ? (
            <Undo2 className="size-3.5" aria-hidden="true" />
          ) : (
            <Send className="size-3.5" aria-hidden="true" />
          )}
          {isPublished ? "Back to draft" : "Publish"}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy !== ""}
          className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-xl px-2 text-[13px] font-semibold text-[#8c1d24] hover:bg-[#fbeaea] disabled:opacity-50"
        >
          {busy === "delete" ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 className="size-3.5" aria-hidden="true" />
          )}
          Delete
        </button>
      </div>
    </Card>
  );
}
