"use client";

import Link from "next/link";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import InteractiveLabRenderer from "@/app/components/interactive-lab-renderer";
import type { InteractiveLabPublicPayload } from "@/lib/assignments/domain";

type Result = { studentId: string; assignment: { id: string; title: string; course: { id: string; title: string } }; labs: Array<{ id: string; ordinal: number; versionId: string; version: number; type: string; payload: InteractiveLabPublicPayload }> };

export default function InteractiveLabStudentPage({ assignmentId }: { assignmentId: string }) {
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
  if (error) return <main className="min-h-screen bg-slate-50 p-8"><div className="mx-auto max-w-4xl"><Link href="/student" className="text-sm font-semibold text-[#24496f]">← Back</Link><p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p></div></main>;
  if (!result) return <main className="grid min-h-screen place-items-center bg-slate-50"><LoaderCircle className="size-7 animate-spin text-[#193b61]" /></main>;
  return <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-800"><div className="mx-auto max-w-5xl"><Link href="/student" className="inline-flex items-center gap-2 text-sm font-semibold text-[#24496f]"><ArrowLeft className="size-4"/>Dashboard</Link><header className="mt-5 rounded-2xl bg-[#17324f] p-6 text-white"><p className="text-xs font-semibold uppercase tracking-widest text-[#b9cada]">{result.assignment.course.title}</p><h1 className="mt-2 text-2xl font-semibold">{result.assignment.title}</h1><p className="mt-2 text-sm text-[#d9e4ed]">Practice only — not graded. Progress is stored only in this browser.</p></header><div className="mt-6 space-y-6">{result.labs.map((lab, index) => <section key={lab.id} aria-labelledby={`lab-${lab.id}`}><div className="mb-3 flex items-center justify-between"><h2 id={`lab-${lab.id}`} className="text-lg font-semibold text-[#193b61]">Lab {index + 1}</h2><span className="text-xs text-slate-500">Version {lab.version} · {lab.type.replaceAll("_", " ")}</span></div><InteractiveLabRenderer payload={lab.payload} storageKey={`interactive-lab:${result.studentId}:${result.assignment.id}:${lab.id}:${lab.versionId}`} /></section>)}</div></div></main>;
}
