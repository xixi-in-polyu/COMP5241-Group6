"use client";

import { Archive, BookOpen, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { UnifiedCourse } from "@/lib/courses/types";

export function UnifiedCourseCard({ course }: { course: UnifiedCourse }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function action(name: "archive" | "restore") {
    const message = name === "archive"
      ? `Archive “${course.title}”? It will be hidden from active courses and its share link will stop working.`
      : `Restore “${course.title}” as a draft?`;
    if (!window.confirm(message)) return;
    setBusy(true);
    const response = await fetch(`/api/courses/${course.id}/${name}`, { method: "POST" });
    setBusy(false);
    if (response.ok) router.refresh();
  }
  function openPreview() {
    router.push(`/courses/${course.id}`);
  }

  function handleCardKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPreview();
    }
  }

  return <article className="flex min-h-60 cursor-pointer flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#7791aa] hover:shadow-md" onClick={(event) => { if ((event.target as HTMLElement).closest("a,button")) return; openPreview(); }} onKeyDown={handleCardKeyDown} role="link" tabIndex={0}>
    <div className="flex items-center justify-between"><BookOpen className="size-5 text-[#385f88]"/><span className="rounded-full bg-[#eef2f6] px-2.5 py-1 text-xs">{course.publicationStatus}</span></div>
    <h2 className="mt-4 text-lg font-semibold text-[#193b61]">{course.title}</h2>
    <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{course.description || "No description provided."}</p>
    <p className="mt-3 text-xs text-slate-500">{course.chapters.length} chapters · {course.materials.length} materials{course.ownerRole === "teacher" ? ` · ${course.assignmentCount} assignments` : ""}</p>
    <div className="mt-auto flex items-center gap-2 pt-4"><Link href={`/courses/${course.id}/edit`} className="rounded-lg bg-[#193b61] px-3 py-2 text-xs font-semibold text-white">Edit</Link><button disabled={busy} onClick={() => void action(course.archivedAt ? "restore" : "archive")} className="ml-auto rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50" aria-label={course.archivedAt ? "Restore course" : "Archive course"}>{course.archivedAt ? <RotateCcw className="size-4"/> : <Archive className="size-4"/>}</button></div>
  </article>;
}
