"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { PageShell } from "@/app/components/page-shell";
import InteractiveLabRenderer from "@/app/components/interactive-lab-renderer";
import type { InteractiveLabPublicPayload } from "@/lib/assignments/domain";

type StudentQuestion = {
  id: string;
  type: "single_choice" | "multi_choice" | "fill_blank" | "short_answer";
  prompt: string;
  options: string[];
  score: number;
};

type Result = {
  studentId: string;
  assignment: { id: string; title: string; course: { id: string; title: string } };
  questions: StudentQuestion[];
  labs: Array<{ id: string; ordinal: number; versionId: string; version: number; type: string; payload: InteractiveLabPublicPayload }>;
};

function QuestionResponse({ question }: { question: StudentQuestion }) {
  if (question.type === "single_choice" || question.type === "multi_choice") {
    return (
      <fieldset className="mt-4 grid gap-2">
        <legend className="sr-only">Choose {question.type === "single_choice" ? "one answer" : "all applicable answers"}</legend>
        {question.options.map((option, index) => (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-700 hover:border-[#9bb2c8]" key={`${question.id}-${index}`}>
            <input className="mt-0.5" name={question.id} type={question.type === "single_choice" ? "radio" : "checkbox"} />
            <span><b className="mr-2 text-[#193b61]">{String.fromCharCode(65 + index)}.</b>{option}</span>
          </label>
        ))}
      </fieldset>
    );
  }
  if (question.type === "fill_blank") {
    return <input aria-label="Your answer" className="mt-4 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#7791aa] focus:ring-4 focus:ring-[#e8eef4]" placeholder="Type your answer" />;
  }
  return <textarea aria-label="Your answer" className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-[#7791aa] focus:ring-4 focus:ring-[#e8eef4]" placeholder="Write your answer" rows={4} />;
}

export default function InteractiveLabStudentPage({ assignmentId, user }: { assignmentId: string; user: { id: string; email: string } }) {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch(`/api/student/assignments/${assignmentId}/interactive-labs`).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load the assignment.");
      if (active) setResult(body);
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load the assignment."); });
    return () => { active = false; };
  }, [assignmentId]);
  if (error) return <PageShell breadcrumbs={[{ label: "Assignment" }]} homeHref="/student" user={user}><p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p></PageShell>;
  if (!result) return <PageShell breadcrumbs={[{ label: "Assignment" }]} homeHref="/student" user={user}><div className="grid min-h-[60vh] place-items-center"><LoaderCircle className="size-7 animate-spin text-[#193b61]" /></div></PageShell>;
  return (
    <PageShell breadcrumbs={[{ href: `/student/courses/${result.assignment.course.id}`, label: result.assignment.course.title }, { label: result.assignment.title }]} homeHref="/student" user={user}>
      <div className="mx-auto w-full max-w-5xl">
        <header className="mt-5 rounded-2xl bg-[#17324f] p-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#b9cada]">{result.assignment.course.title}</p>
          <h1 className="mt-2 text-2xl font-semibold">{result.assignment.title}</h1>
          <p className="mt-2 text-sm text-[#d9e4ed]">Practice only — responses on this page are not submitted.</p>
        </header>

        {result.questions.length ? (
          <section aria-labelledby="questions-heading" className="mt-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-[#193b61]" id="questions-heading">Questions</h2>
                <p className="mt-1 text-sm text-slate-500">Work through the published questions at your own pace.</p>
              </div>
              <span className="text-sm text-slate-500">{result.questions.length} question{result.questions.length === 1 ? "" : "s"}</span>
            </div>
            <div className="mt-4 space-y-4">
              {result.questions.map((question, index) => (
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={question.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#54738f]">Question {index + 1} · {question.type.replaceAll("_", " ")}</p>
                      <h3 className="mt-2 text-base font-semibold leading-6 text-[#193b61]">{question.prompt}</h3>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#eef2f6] px-2.5 py-1 text-xs font-semibold text-[#54738f]">{question.score} pts</span>
                  </div>
                  <QuestionResponse question={question} />
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {result.labs.length ? (
          <section aria-labelledby="labs-heading" className="mt-8 space-y-6">
            <h2 className="text-xl font-semibold text-[#193b61]" id="labs-heading">Interactive labs</h2>
            {result.labs.map((lab, index) => <section key={lab.id} aria-labelledby={`lab-${lab.id}`}><div className="mb-3 flex items-center justify-between"><h3 id={`lab-${lab.id}`} className="text-lg font-semibold text-[#193b61]">Lab {index + 1}</h3><span className="text-xs text-slate-500">Version {lab.version} · {lab.type.replaceAll("_", " ")}</span></div><InteractiveLabRenderer payload={lab.payload} storageKey={`interactive-lab:${result.studentId}:${result.assignment.id}:${lab.id}:${lab.versionId}`} /></section>)}
          </section>
        ) : null}

        {!result.questions.length && !result.labs.length ? <section className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-6"><h2 className="text-base font-semibold text-[#193b61]">No assignment content</h2><p className="mt-1 text-sm text-slate-500">This assignment has been published, but it does not contain questions or interactive labs.</p></section> : null}
      </div>
    </PageShell>
  );
}
