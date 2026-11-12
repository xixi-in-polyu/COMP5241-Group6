"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { PageShell } from "@/app/components/page-shell";
import InteractiveLabRenderer from "@/app/components/interactive-lab-renderer";
import type { InteractiveLabPublicPayload } from "@/lib/assignments/domain";

type Result = { studentId: string; assignment: { id: string; title: string; course: { id: string; title: string } }; labs: Array<{ id: string; ordinal: number; versionId: string; version: number; type: string; payload: InteractiveLabPublicPayload }> };

export default function InteractiveLabStudentPage({ assignmentId, user }: { assignmentId: string; user: { id: string; email: string } }) {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch(`/api/student/assignments/${assignmentId}/interactive-labs`).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load Interactive Labs.");
      if (active) setResult(body);
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load Interactive Labs."); });
    return () => { active = false; };
  }, [assignmentId]);
  if (error) return <PageShell breadcrumbs={[{ label: "Interactive Lab" }]} homeHref="/student" user={user}><p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p></PageShell>;
  if (!result) return <PageShell breadcrumbs={[{ label: "Interactive Lab" }]} homeHref="/student" user={user}><div className="grid min-h-[60vh] place-items-center"><LoaderCircle className="size-7 animate-spin text-[#193b61]" /></div></PageShell>;
  return <PageShell breadcrumbs={[{ href: `/student/courses/${result.assignment.course.id}`, label: result.assignment.course.title }, { label: result.assignment.title }]} homeHref="/student" user={user}><div className="mx-auto w-full max-w-5xl"><header className="mt-5 rounded-2xl bg-[#17324f] p-6 text-white"><p className="text-xs font-semibold uppercase tracking-widest text-[#b9cada]">{result.assignment.course.title}</p><h1 className="mt-2 text-2xl font-semibold">{result.assignment.title}</h1><p className="mt-2 text-sm text-[#d9e4ed]">Practice only — not graded. Progress is stored only in this browser.</p></header><div className="mt-6 space-y-6">{result.labs.map((lab, index) => <section key={lab.id} aria-labelledby={`lab-${lab.id}`}><div className="mb-3 flex items-center justify-between"><h2 id={`lab-${lab.id}`} className="text-lg font-semibold text-[#193b61]">Lab {index + 1}</h2><span className="text-xs text-slate-500">Version {lab.version} · {lab.type.replaceAll("_", " ")}</span></div><InteractiveLabRenderer payload={lab.payload} storageKey={`interactive-lab:${result.studentId}:${result.assignment.id}:${lab.id}:${lab.versionId}`} /></section>)}</div></div></PageShell>;
}
