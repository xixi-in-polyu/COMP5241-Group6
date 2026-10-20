"use client";

import { upload } from "@vercel/blob/client";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, CheckCircle2, ChevronDown, FileText, GripVertical, Lightbulb, LoaderCircle, Pencil, Plus, RefreshCw, Save, Send, Sparkles, Trash2, Upload, WandSparkles, X } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type QuestionType = "single_choice" | "multi_choice" | "fill_blank" | "short_answer";
type Question = { id: string; origin: "ai_generated" | "teacher_authored"; type: QuestionType; objective: "knowledge" | "comprehension" | "application" | "synthesis" | "innovation"; difficulty: "easy" | "medium" | "hard"; entityIds: string[]; prompt: string; options: string[]; answer: string; explanation: string; score: number; evidenceRefs: string[]; warnings: string[] };
type FailedSlot = { index: number; type: QuestionType; objective: Question["objective"]; difficulty: Question["difficulty"]; entityIds: string[]; score: number; reason: string };
type Candidate = { id: string; questionId: string; instruction: string; payload: Question; status: string };
type Evidence = { id: string; quote: string; sourceName: string; locator: string; segmentId: string; materialId: string };
type Entity = { id: string; name: string; description: string; aliases: string[]; parentId: string | null; importance: "core" | "supporting" | "extension"; selected: boolean; evidence: Evidence[] };
type Material = { id: string; name: string; kind: "FILE" | "TRANSCRIPT"; status: string; size: number | null; errorCode?: string | null; errorDetail?: string | null };
type Brief = { title: string; instructions: string; count: number; types: QuestionType[]; difficulty: { easy: number; medium: number; hard: number }; objectives: Question["objective"][]; coverageEntityIds: string[] };
type Suggestion = { id: string; label: string; kind: "instruction" | "coverage"; payload: string | string[] };
type Assignment = { id: string; title: string; status: string; phase: string; entityRevision: number; originalBrief: Brief | null; version: number; questions: Question[]; failedSlots: FailedSlot[]; qualityWarnings: string[]; error?: string; submittedAt?: string; questionVersions: Candidate[]; materials: Material[]; entities: Entity[]; course: { title?: string; entities: Entity[] } };

async function api<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<T> { const response = await fetch(url, init); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || "Request failed."); return body; }
const field = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-[#e8eef4] disabled:bg-slate-50";
const documentMimes: Record<string, string> = { pdf: "application/pdf", txt: "text/plain", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation" };

function sourceMime(file: File) {
  if (file.type) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  return documentMimes[extension] || "text/plain";
}

function emptyQuestion(entityId?: string): Question { return { id: crypto.randomUUID(), origin: "teacher_authored", type: "short_answer", objective: "comprehension", difficulty: "medium", entityIds: entityId ? [entityId] : [], prompt: "", options: [], answer: "", explanation: "", score: 10, evidenceRefs: [], warnings: [] }; }

function optionsForType(type: QuestionType, current: string[]) {
  const minimum = type === "single_choice" ? 2 : type === "multi_choice" ? 3 : 0;
  if (!minimum) return [];
  return [...current, ...Array.from({ length: Math.max(0, minimum - current.length) }, () => "")];
}

function answerAfterOptionRemoval(answer: string, removedIndex: number) {
  return answer.split(",").map((value) => value.trim().toUpperCase()).filter(Boolean).map((letter) => letter.charCodeAt(0) - 65).filter((index) => index >= 0 && index !== removedIndex).map((index) => String.fromCharCode(65 + (index > removedIndex ? index - 1 : index))).join(", ");
}

export default function AssignmentEditor({ courseId, assignmentId }: { courseId: string; assignmentId: string }) {
  const [assignment, setAssignment] = useState<Assignment | null>(null); const [questions, setQuestions] = useState<Question[]>([]); const [dirty, setDirty] = useState(false); const [busy, setBusy] = useState(""); const [notice, setNotice] = useState(""); const [manualSlot, setManualSlot] = useState<number | null>(null); const [manualDraft, setManualDraft] = useState<Question>(() => emptyQuestion()); const [regenInstructions, setRegenInstructions] = useState<Record<string, string>>({}); const [activeStep, setActiveStep] = useState<number | null>(null);
  const refresh = useCallback(async (preserveLocal = false) => { const result = await api<{ assignment: Assignment }>(`/api/assignments/${assignmentId}`); setAssignment(result.assignment); if (!preserveLocal) { setQuestions(result.assignment.questions); setDirty(false); } }, [assignmentId]);
  useEffect(() => { queueMicrotask(() => void refresh().catch((error) => setNotice(error.message))); }, [refresh]);
  useEffect(() => { if (!assignment || !["INGESTING", "EXTRACTING_ENTITIES", "GENERATING"].includes(assignment.status)) return; const timer = setInterval(() => void refresh(dirty), 3000); return () => clearInterval(timer); }, [assignment, dirty, refresh]);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);
  useEffect(() => { const intercept = (event: MouseEvent) => { if (!dirty) return; const anchor = (event.target as HTMLElement).closest("a"); const href = anchor?.getAttribute("href"); if (href?.startsWith("/") && !window.confirm("You have unsaved changes. Leave this page?")) event.preventDefault(); }; document.addEventListener("click", intercept, true); return () => document.removeEventListener("click", intercept, true); }, [dirty]);
  const total = useMemo(() => questions.reduce((sum, item) => sum + item.score, 0), [questions]);
  const locked = assignment?.status === "SUBMITTED";
  function update(id: string, values: Partial<Question>) { setQuestions((items) => items.map((item) => item.id === id ? { ...item, ...values } : item)); setDirty(true); }
  function addQuestion() { if (!assignment) return; setQuestions((items) => [...items, emptyQuestion(assignment.entities.find((item) => item.selected)?.id)]); setDirty(true); }
  async function run(label: string, task: () => Promise<void>, shouldRefresh = true) { setBusy(label); setNotice(""); try { await task(); if (shouldRefresh) await refresh(dirty); } catch (error) { setNotice(error instanceof Error ? error.message : "Action failed."); } finally { setBusy(""); } }
  async function save() { await run("Saving draft", async () => { const result = await api<{ version: number }>(`/api/assignments/${assignmentId}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ version: assignment!.version, questions }) }); setAssignment((value) => value ? { ...value, version: result.version, questions } : value); setDirty(false); }, false); }
  if (!assignment) return <main className="grid min-h-screen place-items-center bg-slate-50"><LoaderCircle className="size-7 animate-spin"/></main>;
  const currentStep = assignmentStep(assignment);
  const viewedStep = activeStep ?? currentStep;
  if (viewedStep !== 3 || !["DRAFT", "SUBMITTED"].includes(assignment.status)) {
    return <WorkflowPage courseId={courseId} assignment={assignment} assignmentId={assignmentId} currentStep={currentStep} viewedStep={viewedStep} onStep={setActiveStep} onRefresh={() => refresh(dirty)} />;
  }
  return <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-800"><div className="mx-auto max-w-6xl">
    <Link href={`/teacher/courses/${courseId}`} className="inline-flex items-center gap-2 text-sm font-medium text-[#24496f]"><ArrowLeft className="size-4"/>Course workspace</Link>
    <WorkflowTabs currentStep={currentStep} viewedStep={viewedStep} onStep={setActiveStep} />
    <header className="mt-5 flex flex-col justify-between gap-5 rounded-2xl bg-[#17324f] px-6 py-6 text-white shadow-sm lg:flex-row lg:items-center"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#a9bfd3]">03 · Review draft</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">{assignment.title}</h1><p className="mt-1 text-xs text-[#bdccda]">Version {assignment.version} · {locked ? `Submitted ${new Date(assignment.submittedAt!).toLocaleString()}` : dirty ? "Unsaved changes" : "Draft saved"}</p></div><dl className="grid grid-cols-3 gap-2 sm:grid-cols-5">{[["Requested", assignment.originalBrief?.count ?? 0], ["Questions", questions.length], ["Total score", total], ["Failed", assignment.failedSlots.length], ["Warnings", assignment.qualityWarnings.length]].map(([label, value]) => <div key={label} className="min-w-20 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-center"><dd className="text-lg font-semibold text-white">{value}</dd><dt className="mt-0.5 text-[9px] uppercase tracking-wider text-[#bdccda]">{label}</dt></div>)}</dl></header>
    {notice && <p role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{notice}</p>}
    {!!assignment.qualityWarnings.length && <section className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><h2 className="text-sm font-semibold text-amber-900">Advisory quality warnings</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-800">{assignment.qualityWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></section>}
    {!!assignment.failedSlots.length && <section className="mt-6 rounded-2xl border border-red-200 bg-white p-6"><h2 className="text-lg font-semibold text-red-800">Failed question slots</h2><p className="mt-1 text-sm text-slate-600">Retry any slot as often as needed, create a teacher-authored replacement, or remove it.</p><div className="mt-4 space-y-3">{assignment.failedSlots.map((slot) => <article key={slot.index} className="rounded-xl border border-red-100 bg-red-50/50 p-4"><p className="text-sm font-semibold">Slot {slot.index + 1}: {slot.type.replaceAll("_", " ")} · {slot.difficulty}</p><p className="mt-1 text-xs text-red-700">{slot.reason}</p><div className="mt-3 flex flex-wrap gap-2"><button disabled={!!busy || locked} onClick={() => void run("Retrying slot", async () => { const version = assignment.version; await api(`/api/assignments/${assignmentId}/slots/${slot.index}/retry`, { method: "POST" }); for (let attempt = 0; attempt < 20; attempt += 1) { await new Promise((resolve) => setTimeout(resolve, 3000)); const result = await api<{ assignment: Assignment }>(`/api/assignments/${assignmentId}`); if (result.assignment.version > version) return; } throw new Error("Retry is still running. Refresh shortly to see its result."); })} className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold"><RefreshCw className="mr-1 inline size-3"/>Retry with AI</button><button disabled={!!busy || locked} onClick={() => { setManualDraft({ ...emptyQuestion(slot.entityIds[0]), type: slot.type, objective: slot.objective, difficulty: slot.difficulty, score: slot.score }); setManualSlot(slot.index); }} className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold">Create manually</button><button disabled={!!busy || locked} onClick={() => void run("Removing slot", async () => { await api(`/api/assignments/${assignmentId}/slots/${slot.index}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ version: assignment.version }) }); })} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700">Delete slot</button></div></article>)}</div></section>}
    {manualSlot !== null && (
      <ManualForm title={`Manual replacement for slot ${manualSlot + 1}`} question={manualDraft} entities={assignment.entities} onChange={setManualDraft} onCancel={() => setManualSlot(null)} onSubmit={() => void run("Creating question", async () => { await api(`/api/assignments/${assignmentId}/slots/${manualSlot}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ version: assignment.version, question: manualDraft }) }); setManualSlot(null); })} />
    )}
    <section className="mt-5"><div className="flex flex-wrap items-center gap-2 border-b border-slate-200"><div className="flex items-center gap-2 border-b-2 border-[#193b61] px-3 py-3 text-sm font-semibold text-[#193b61]"><FileText className="size-4" />Questions <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px]">{questions.length}</span></div><div className="flex-1" /><button aria-label="Save" disabled={locked || !!busy || !dirty || assignment.failedSlots.length > 0} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#193b61] disabled:opacity-40"><Save className="size-4"/>Save</button><button disabled={locked || !!busy || dirty || assignment.failedSlots.length > 0 || !questions.length} onClick={() => void run("Submitting", async () => { await api(`/api/assignments/${assignmentId}/submit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ version: assignment.version }) }); })} className="inline-flex items-center gap-2 rounded-lg bg-[#193b61] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"><Send className="size-4"/>Submit</button></div><div className="mt-4 space-y-3">{questions.map((question, index) => <QuestionCard key={question.id} question={question} index={index} count={questions.length} locked={locked} dirty={dirty} candidate={assignment.questionVersions.find((item) => item.questionId === question.id)} instruction={regenInstructions[question.id] || ""} entities={assignment.entities} onInstruction={(value) => setRegenInstructions((items) => ({ ...items, [question.id]: value }))} onChange={(values) => update(question.id, values)} onMove={(delta) => { const next = [...questions]; const target = index + delta; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; setQuestions(next); setDirty(true); }} onDelete={() => { setQuestions((items) => items.filter((item) => item.id !== question.id)); setDirty(true); }} onRegenerate={() => void run("Generating candidate", async () => { await api(`/api/assignments/${assignmentId}/questions/${question.id}/candidate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ instruction: regenInstructions[question.id] }) }); })} onResolve={(action) => void run(`${action} candidate`, async () => { await api(`/api/assignments/${assignmentId}/questions/${question.id}/candidate`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, version: assignment.version }) }); })}/>)}{!locked && <button type="button" onClick={addQuestion} className="group flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 px-5 py-5 text-sm font-semibold text-[#54738f] transition-colors hover:border-[#9bb2c8] hover:bg-[#dfe9f2] hover:text-[#193b61] focus-visible:border-[#7f9bb5] focus-visible:bg-[#dfe9f2] focus-visible:text-[#193b61] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#dbe7f2]"><span className="grid size-7 place-items-center rounded-full border border-slate-300 bg-white transition-colors group-hover:border-[#9bb2c8] group-hover:bg-[#f4f8fb]"><Plus className="size-4" /></span>Add question</button>}</div></section>
    {busy && <div className="fixed bottom-5 right-5 flex items-center gap-2 rounded-xl bg-[#193b61] px-4 py-3 text-sm font-semibold text-white shadow-lg"><LoaderCircle className="size-4 animate-spin"/>{busy}</div>}
  </div></main>;
}

const workflowSteps = ["Sources", "Knowledge", "Brief", "Draft"];

function assignmentStep(assignment: Assignment) {
  if (["INGESTING", "AWAITING_MATERIAL_FIX"].includes(assignment.status)) return 0;
  if (["EXTRACTING_ENTITIES", "AWAITING_ENTITY_REVIEW"].includes(assignment.status)) return 1;
  if (assignment.status === "READY_TO_GENERATE") return 2;
  if (assignment.status === "FAILED") return assignment.originalBrief ? 3 : assignment.entities.length ? 1 : 0;
  return 3;
}

function WorkflowTabs({ currentStep, viewedStep, onStep, processing = false }: { currentStep: number; viewedStep: number; onStep: (step: number) => void; processing?: boolean }) {
  return <nav aria-label="Assignment workflow" className="mt-5 grid grid-cols-4 overflow-hidden rounded-xl border border-slate-200 bg-white">{workflowSteps.map((step, index) => {
    const disabled = index > currentStep;
    const current = index === viewedStep;
    return <button key={step} type="button" disabled={disabled} onClick={() => onStep(index)} className={`flex items-center justify-center gap-2 border-r border-slate-200 px-2 py-3 text-xs font-semibold last:border-r-0 sm:text-sm disabled:cursor-not-allowed ${current ? "bg-[#193b61] text-white" : disabled ? "text-slate-300" : "text-[#385f88] hover:bg-slate-50"}`}><span className={`grid size-5 place-items-center rounded-full ${current ? "bg-white/20" : index < currentStep ? "bg-[#e5edf5]" : ""}`}>{processing && index === currentStep ? <LoaderCircle className="size-3 animate-spin" /> : index < currentStep ? <Check className="size-3" /> : index + 1}</span>{step}</button>;
  })}</nav>;
}

function WorkflowPage({ courseId, assignmentId, assignment, currentStep, viewedStep, onStep, onRefresh }: { courseId: string; assignmentId: string; assignment: Assignment; currentStep: number; viewedStep: number; onStep: (step: number) => void; onRefresh: () => Promise<void> }) {
  const [notice, setNotice] = useState("");
  const [retrying, setRetrying] = useState(false);
  async function retryWorkflow() {
    setRetrying(true);
    setNotice("");
    try {
      await api(`/api/assignments/${assignmentId}/retry`, { method: "POST" });
      await onRefresh();
      window.setTimeout(() => void onRefresh(), 1500);
      window.setTimeout(() => void onRefresh(), 4000);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not retry workflow.");
    } finally {
      setRetrying(false);
    }
  }
  return <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-800"><div className="mx-auto max-w-6xl">
    <Link href={`/teacher/courses/${courseId}`} className="inline-flex items-center gap-2 text-sm font-medium text-[#24496f]"><ArrowLeft className="size-4" />Course workspace</Link>
    <header className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#54738f]">{assignment.course.title || "Assignment workflow"}</p><h1 className="mt-2 font-serif text-3xl text-[#142f4d]">{assignment.title}</h1><p className="mt-2 text-sm text-slate-600">{assignment.phase}</p></div><span className="rounded-full bg-[#edf2f7] px-3 py-1.5 text-xs font-semibold text-[#284b70]">{assignment.status.replaceAll("_", " ")}</span></div></header>
    <WorkflowTabs currentStep={currentStep} viewedStep={viewedStep} onStep={onStep} processing={["INGESTING", "EXTRACTING_ENTITIES", "GENERATING"].includes(assignment.status)} />
    {notice && <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{notice}</p>}
    {assignment.status === "FAILED" && viewedStep === currentStep && <section className="mt-6 rounded-2xl border border-red-200 bg-white p-6"><h2 className="font-semibold text-red-800">Workflow failed</h2><p className="mt-2 text-sm text-slate-600">{assignment.error || "The workflow could not continue."}</p>{assignment.phase === "Assignment source workflow failed" && <button disabled={retrying} onClick={() => void retryWorkflow()} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-800 disabled:opacity-50">{retrying ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}{retrying ? "Restarting…" : "Retry workflow"}</button>}</section>}
    <div className={viewedStep === 0 ? "" : "hidden"}><SourcesPanel courseId={courseId} assignmentId={assignmentId} assignment={assignment} editable={currentStep === 0 && assignment.status === "AWAITING_MATERIAL_FIX"} onRefresh={onRefresh} onNotice={setNotice} /></div>
    {currentStep >= 1 && <div className={viewedStep === 1 ? "" : "hidden"}><KnowledgePanel assignmentId={assignmentId} assignment={assignment} editable={currentStep === 1 && assignment.status === "AWAITING_ENTITY_REVIEW"} onRefresh={onRefresh} onNotice={setNotice} /></div>}
    {currentStep >= 2 && <div className={viewedStep === 2 ? "" : "hidden"}><BriefPanel assignmentId={assignmentId} assignment={assignment} editable={currentStep === 2 && assignment.status === "READY_TO_GENERATE"} onRefresh={onRefresh} onNotice={setNotice} /></div>}
    {currentStep === 3 && <div className={viewedStep === 3 ? "" : "hidden"}><section className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><LoaderCircle className="mx-auto size-8 animate-spin text-[#193b61]" /><h2 className="mt-4 text-xl font-semibold text-[#193b61]">Generating grounded questions</h2><p className="mt-2 text-sm text-slate-600">Questions run in bounded batches. Each failed first attempt is repaired once automatically.</p></section></div>}
  </div></main>;
}

function SourcesPanel({ courseId, assignmentId, assignment, editable, onRefresh, onNotice }: { courseId: string; assignmentId: string; assignment: Assignment; editable: boolean; onRefresh: () => Promise<void>; onNotice: (message: string) => void }) {
  const [busy, setBusy] = useState("");
  async function act(label: string, task: () => Promise<void>) { setBusy(label); onNotice(""); try { await task(); await onRefresh(); window.setTimeout(() => void onRefresh(), 1200); window.setTimeout(() => void onRefresh(), 3000); } catch (error) { onNotice(error instanceof Error ? error.message : "Source action failed."); } finally { setBusy(""); } }
  async function uploadFile(file: File) {
    const mimeType = sourceMime(file);
    const blob = await upload(`learning-platform/courses/${courseId}/assignments/${assignmentId}/${crypto.randomUUID()}/${file.name}`, file, { access: "private", handleUploadUrl: "/api/uploads/token", clientPayload: JSON.stringify({ courseId, assignmentId, contentType: mimeType, size: file.size }) });
    return { kind: "FILE", name: file.name, mimeType, size: file.size, blobPathname: blob.pathname };
  }
  const processing = ["INGESTING", "EXTRACTING_ENTITIES"].includes(assignment.status);
  return <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-[#193b61]">Sources</h2><p className="mt-1 text-sm text-slate-500">Assignment evidence is private and remains scoped to this course.</p></div>{processing && <LoaderCircle className="size-5 animate-spin text-[#385f88]" />}</div>
    {!assignment.materials.length ? <div className="mt-4 rounded-xl border border-[#d8e5f3] bg-[#f2f7fc] p-4 text-sm text-[#24496f]">Using a snapshot of confirmed course knowledge; no additional source was attached.</div> : <div className="mt-4 space-y-3">{assignment.materials.map((material) => <article key={material.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center gap-3"><FileText className="size-5 text-[#54738f]" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{material.name}</p><p className="text-xs text-slate-500">{material.kind} · {material.status}{material.size ? ` · ${(material.size / 1024 / 1024).toFixed(2)} MiB` : ""}</p>{material.errorDetail && <p className="mt-1 text-xs text-red-700">{material.errorCode}: {material.errorDetail}</p>}</div>{editable && material.status === "FAILED" && <div className="flex flex-wrap gap-2"><button disabled={!!busy} onClick={() => void act("Retrying", async () => { await api(`/api/assignments/${assignmentId}/materials/${material.id}/retry`, { method: "POST" }); })} className="rounded-lg border px-3 py-2 text-xs font-semibold"><RefreshCw className="mr-1 inline size-3" />Retry</button><label className="cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold"><Upload className="mr-1 inline size-3" />Replace<input type="file" accept=".pdf,.txt,.docx,.pptx" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; void act("Replacing source", async () => { const source = await uploadFile(file); await api(`/api/assignments/${assignmentId}/materials/${material.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(source) }); }); }} /></label><button disabled={!!busy} onClick={() => void act("Removing source", async () => { await api(`/api/assignments/${assignmentId}/materials/${material.id}`, { method: "DELETE" }); })} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700"><Trash2 className="mr-1 inline size-3" />Delete</button></div>}</div></article>)}</div>}
    {processing && <p className="mt-4 text-sm text-slate-500">Processing sources and extracting grounded knowledge…</p>}
  </section>;
}

function KnowledgePanel({ assignmentId, assignment, editable, onRefresh, onNotice }: { assignmentId: string; assignment: Assignment; editable: boolean; onRefresh: () => Promise<void>; onNotice: (message: string) => void }) {
  const [entities, setEntities] = useState(assignment.entities);
  const [busy, setBusy] = useState("");
  const [mergeIds, setMergeIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  function patch(id: string, values: Partial<Entity>) { setEntities((items) => items.map((item) => item.id === id ? { ...item, ...values } : item)); }
  function merge() {
    if (mergeIds.length < 2) return;
    const target = entities.find((item) => item.id === mergeIds[0]);
    if (!target) return;
    const selected = entities.filter((item) => mergeIds.includes(item.id));
    const removed = new Set(mergeIds.slice(1));
    setEntities((items) => items
      .filter((item) => !removed.has(item.id))
      .map((item) => item.id === target.id ? {
        ...item,
        aliases: [...new Set([...item.aliases, ...selected.flatMap((entry) => [entry.name, ...entry.aliases])])].filter((alias) => alias !== item.name),
        evidence: selected.flatMap((entry) => entry.evidence).filter((entry, index, all) => all.findIndex((other) => other.id === entry.id) === index),
      } : removed.has(item.parentId || "") ? { ...item, parentId: target.id } : item));
    setMergeIds([]);
    setEditingId((current) => removed.has(current || "") ? null : current);
  }
  function remove(entity: Entity) {
    const childCount = entities.filter((item) => item.parentId === entity.id).length;
    const warning = childCount ? ` ${childCount} child concept${childCount === 1 ? "" : "s"} will move to the top level.` : "";
    if (!window.confirm(`Delete “${entity.name}”?${warning}`)) return;
    setEntities((items) => items.filter((item) => item.id !== entity.id).map((item) => item.parentId === entity.id ? { ...item, parentId: null } : item));
    setMergeIds((items) => items.filter((id) => id !== entity.id));
    setEditingId((current) => current === entity.id ? null : current);
  }
  async function persist(confirm: boolean) { setBusy(confirm ? "Confirming" : "Saving"); onNotice(""); try { const saved = await api<{ revision: number }>(`/api/assignments/${assignmentId}/entities`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ revision: assignment.entityRevision, entities }) }); if (confirm) await api(`/api/assignments/${assignmentId}/entities/confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ revision: saved.revision }) }); await onRefresh(); if (confirm) { window.setTimeout(() => void onRefresh(), 1200); window.setTimeout(() => void onRefresh(), 3000); } } catch (error) { onNotice(error instanceof Error ? error.message : "Knowledge action failed."); } finally { setBusy(""); } }
  const selectedCount = entities.filter((entity) => entity.selected).length;
  return <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-6 py-6">
      <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#54738f]">01 · Knowledge map</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#142f4d]">Review what the material teaches</h2><p className="mt-1 text-sm text-slate-500">Edit coverage and hierarchy. Merge selection is separate from assessment inclusion.</p></div>
      <div className="min-w-24 rounded-xl border border-slate-200 bg-slate-50 px-5 py-3 text-center"><strong className="block text-xl text-[#193b61]">{selectedCount}</strong><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">selected</span></div>
    </div>
    {!editable && entities.length > 0 && <div className="mx-6 mt-5 flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800"><CheckCircle2 className="size-4" />This completed step is read-only.</div>}
    <div className="flex items-center justify-between gap-3 px-6 py-4 text-xs text-slate-500"><span>{entities.length} concepts extracted</span><button type="button" disabled={!editable || mergeIds.length < 2} onClick={merge} className="inline-flex items-center gap-1.5 font-semibold text-[#385f88] disabled:text-slate-300"><WandSparkles className="size-4" />Merge selected ({mergeIds.length})</button></div>
    {!entities.length ? <div className="mx-6 mb-6 flex items-center gap-2 rounded-xl bg-slate-50 p-5 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" />Knowledge extraction is still running.</div> : <div className="grid gap-3 px-6 pb-6 lg:grid-cols-2">{entities.map((entity) => {
      const editing = editable && editingId === entity.id;
      const parent = entities.find((candidate) => candidate.id === entity.parentId);
      return <article key={entity.id} className={`grid grid-cols-[28px_minmax(0,1fr)_32px] items-start gap-3 rounded-2xl border p-4 transition ${entity.selected ? "border-[#b7cadc] bg-[#fbfdff]" : "border-slate-200 bg-slate-50/40"} ${editing ? "ring-2 ring-[#dbe7f2]" : ""}`}>
        <button type="button" disabled={!editable} aria-label={`${entity.selected ? "Exclude" : "Include"} ${entity.name}`} onClick={() => patch(entity.id, { selected: !entity.selected })} className={`grid size-7 place-items-center rounded-lg border disabled:cursor-not-allowed disabled:opacity-50 ${entity.selected ? "border-[#193b61] bg-[#193b61] text-white" : "border-slate-300 bg-white text-transparent"}`}><Check className="size-4" /></button>
        <div className="min-w-0 space-y-3">{editing ? <>
          <input aria-label="Entity name" value={entity.name} onChange={(event) => patch(entity.id, { name: event.target.value })} className="w-full rounded-lg border border-[#9bb2c8] bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-4 focus:ring-[#e8eef4]" />
          <textarea aria-label="Entity description" rows={3} value={entity.description} onChange={(event) => patch(entity.id, { description: event.target.value })} className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-5 outline-none focus:ring-4 focus:ring-[#e8eef4]" />
          <div className="grid gap-2 sm:grid-cols-2"><label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Aliases<input value={entity.aliases.join(", ")} onChange={(event) => patch(entity.id, { aliases: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} className={`mt-1 normal-case ${field}`} /></label><label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Parent concept<select value={entity.parentId || ""} onChange={(event) => patch(entity.id, { parentId: event.target.value || null })} className={`mt-1 normal-case ${field}`}><option value="">No parent</option>{entities.filter((item) => item.id !== entity.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
        </> : <>
          <div><h3 className="text-sm font-semibold leading-5 text-[#142f4d]">{entity.name}</h3><p className="mt-1 text-xs leading-5 text-slate-600">{entity.description || "No description"}</p></div>
          <div className="grid gap-2 sm:grid-cols-2"><div className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2"><span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Aliases</span><strong className="mt-1 block truncate text-[11px] font-semibold text-slate-600">{entity.aliases.length ? entity.aliases.join(", ") : "None"}</strong></div><div className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2"><span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Parent concept</span><strong className="mt-1 block truncate text-[11px] font-semibold text-slate-600">{parent?.name || "No parent"}</strong></div></div>
        </>}
          <label className="flex w-fit items-center gap-2 text-[11px] font-medium text-slate-600"><input type="checkbox" disabled={!editable} checked={mergeIds.includes(entity.id)} onChange={(event) => setMergeIds((ids) => event.target.checked ? [...ids, entity.id] : ids.filter((id) => id !== entity.id))} className="size-3.5 rounded" />Select for merge</label>
          <details className="border-t border-slate-200 pt-3"><summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-medium text-slate-600"><FileText className="size-3.5" />Evidence · {entity.evidence[0]?.locator || "source"}<ChevronDown className="ml-auto size-3.5" /></summary>{entity.evidence.map((entry) => <blockquote key={entry.id} className="mt-2 border-l-2 border-[#b7cadc] pl-3 text-[11px] leading-5 text-slate-500">“{entry.quote}”<footer className="mt-1 text-[10px] text-slate-400">{entry.sourceName} · {entry.locator}</footer></blockquote>)}</details>
        </div>
        <div className="flex flex-col gap-1"><button type="button" disabled={!editable} aria-label={editing ? `Finish editing ${entity.name}` : `Edit ${entity.name}`} onClick={() => setEditingId(editing ? null : entity.id)} className={`grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-[#e8eef4] hover:text-[#193b61] disabled:opacity-30 ${editing ? "bg-[#e8eef4] text-[#193b61]" : ""}`}>{editing ? <Check className="size-4" /> : <Pencil className="size-4" />}</button><button type="button" disabled={!editable} aria-label={`Delete ${entity.name}`} onClick={() => remove(entity)} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"><Trash2 className="size-4" /></button></div>
      </article>;
    })}</div>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-6 py-4"><span className="text-xs text-slate-500">{editable ? "Save changes or confirm to continue to the brief." : "Knowledge is locked after confirmation."}</span>{editable && <div className="flex gap-2"><button disabled={!!busy} onClick={() => void persist(false)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#193b61] disabled:opacity-50"><Save className="size-4" />Save</button><button disabled={!!busy || !selectedCount} onClick={() => void persist(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#193b61] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Confirm knowledge <ArrowRight className="size-4" /></button></div>}</div>
  </section>;
}

function BriefPanel({ assignmentId, assignment, editable, onRefresh, onNotice }: { assignmentId: string; assignment: Assignment; editable: boolean; onRefresh: () => Promise<void>; onNotice: (message: string) => void }) {
  const [brief, setBrief] = useState<Brief>(() => assignment.originalBrief || { title: assignment.title, instructions: "Create a balanced assessment that checks understanding and practical application.", count: 10, types: ["single_choice", "multi_choice", "fill_blank", "short_answer"], difficulty: { easy: 30, medium: 50, hard: 20 }, objectives: ["knowledge", "comprehension", "application"], coverageEntityIds: [] });
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState("");
  async function act(label: string, task: () => Promise<void>) { setBusy(label); onNotice(""); try { await task(); } catch (error) { onNotice(error instanceof Error ? error.message : "Brief action failed."); } finally { setBusy(""); } }
  if (assignment.status === "GENERATING") return <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center"><LoaderCircle className="mx-auto size-8 animate-spin text-[#193b61]" /><h2 className="mt-4 text-xl font-semibold text-[#193b61]">Brief accepted</h2><p className="mt-2 text-sm text-slate-500">Question generation is now running.</p></section>;
  const selectedEntities = assignment.entities.filter((entity) => entity.selected);
  const easyEnd = brief.difficulty.easy;
  const mediumEnd = brief.difficulty.easy + brief.difficulty.medium;
  const visibleSuggestions = suggestions.filter((suggestion) => suggestion.kind === "instruction");
  const applySuggestion = (suggestion: Suggestion) => {
    if (suggestion.kind !== "instruction") return;
    setBrief({ ...brief, instructions: suggestion.payload as string });
    setSuggestions((items) => items.filter((item) => item.id !== suggestion.id));
  };
  return <section className="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-6"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#54738f]">02 · Generation brief</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#142f4d]">Shape the learning check</h2><p className="mt-1 text-sm text-slate-500">AI suggestions change the brief only after you accept them.</p></div>
      {!editable && <div className="mx-6 mt-5 flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800"><CheckCircle2 className="size-4" />This completed step is read-only.</div>}
      <div className="space-y-6 px-6 py-5">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Assignment title<input disabled={!editable} value={brief.title} onChange={(event) => setBrief({ ...brief, title: event.target.value })} className={`mt-2 normal-case ${field}`} /></label>
        <div><label className="text-xs font-bold uppercase tracking-wider text-slate-500">English instructions</label><div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:ring-4 focus-within:ring-[#e8eef4]"><textarea disabled={!editable} value={brief.instructions} onChange={(event) => setBrief({ ...brief, instructions: event.target.value })} rows={5} className="w-full resize-y border-0 px-4 py-3 text-sm leading-6 outline-none disabled:bg-slate-50" />{editable && <div className="flex justify-end border-t border-slate-100 p-2"><button disabled={!!busy} onClick={() => void act("Getting suggestions", async () => { const result = await api<{ suggestions: Suggestion[] }>(`/api/assignments/${assignmentId}/suggestions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ instructions: brief.instructions }) }); setSuggestions(result.suggestions.filter((suggestion) => suggestion.kind === "instruction")); })} className="inline-flex items-center gap-2 rounded-lg border border-[#cad8e5] bg-[#f4f8fb] px-3 py-2 text-xs font-semibold text-[#24496f] disabled:opacity-50">{busy === "Getting suggestions" ? <LoaderCircle className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}Improve with AI</button></div>}</div></div>
        {!!visibleSuggestions.length && <div className="overflow-hidden rounded-xl border border-[#d8e5f3]"><div className="flex items-center gap-2 bg-[#f2f7fc] px-4 py-2.5 text-xs font-semibold text-[#24496f]"><Lightbulb className="size-4" />Suggested improvements</div>{visibleSuggestions.map((suggestion) => <article key={suggestion.id} className="grid grid-cols-[70px_minmax(0,1fr)_auto_auto] items-center gap-3 border-t border-[#d8e5f3] px-4 py-3"><span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Instruction</span><div><h3 className="text-xs font-semibold text-[#193b61]">{suggestion.label}</h3><p className="mt-1 text-[11px] leading-4 text-slate-500">{suggestion.payload}</p></div><button disabled={!editable} onClick={() => applySuggestion(suggestion)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#24496f] disabled:opacity-40"><Check className="size-3.5" />Apply</button><button aria-label={`Dismiss ${suggestion.label}`} onClick={() => setSuggestions((items) => items.filter((item) => item.id !== suggestion.id))} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X className="size-3.5" /></button></article>)}</div>}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4"><span className="text-xs font-semibold text-slate-600">Question count</span><div className="mt-4 flex items-center gap-4"><input disabled={!editable} type="range" min={1} max={20} value={brief.count} onChange={(event) => setBrief({ ...brief, count: Number(event.target.value) })} className="min-w-0 flex-1 accent-[#193b61]" /><div className="flex items-center overflow-hidden rounded-lg border border-slate-200"><button type="button" disabled={!editable || brief.count <= 1} onClick={() => setBrief({ ...brief, count: brief.count - 1 })} className="grid size-8 place-items-center bg-slate-50 text-sm disabled:opacity-30">−</button><output className="grid min-w-10 place-items-center px-2 text-base font-semibold text-[#193b61]">{brief.count}</output><button type="button" disabled={!editable || brief.count >= 20} onClick={() => setBrief({ ...brief, count: brief.count + 1 })} className="grid size-8 place-items-center bg-slate-50 text-sm disabled:opacity-30">+</button></div></div></div>
          <div className="assignment-difficulty-control">
            <span>Difficulty mix</span>
            <div className="assignment-difficulty-range">
              <div className="assignment-difficulty-bar" aria-hidden="true">
                <i className="assignment-difficulty-easy" style={{ width: `${brief.difficulty.easy}%` }} />
                <i className="assignment-difficulty-medium" style={{ width: `${brief.difficulty.medium}%` }} />
                <i className="assignment-difficulty-hard" style={{ width: `${brief.difficulty.hard}%` }} />
              </div>
              <input
                aria-label="Easy difficulty boundary"
                disabled={!editable}
                type="range"
                min={0}
                max={100}
                value={easyEnd}
                onChange={(event) => {
                  const easy = Math.min(mediumEnd, Number(event.target.value));
                  setBrief({ ...brief, difficulty: { easy, medium: mediumEnd - easy, hard: 100 - mediumEnd } });
                }}
              />
              <input
                aria-label="Hard difficulty boundary"
                disabled={!editable}
                type="range"
                min={0}
                max={100}
                value={mediumEnd}
                onChange={(event) => {
                  const end = Math.max(easyEnd, Number(event.target.value));
                  setBrief({ ...brief, difficulty: { easy: easyEnd, medium: end - easyEnd, hard: 100 - end } });
                }}
              />
            </div>
            <div className="assignment-difficulty-legend" aria-live="polite">
              <span className="easy">Easy <b>{brief.difficulty.easy}%</b></span>
              <span className="medium">Medium <b>{brief.difficulty.medium}%</b></span>
              <span className="hard">Hard <b>{brief.difficulty.hard}%</b></span>
            </div>
          </div>
        </div>
        <BriefChecks label="Question types" values={["single_choice", "multi_choice", "fill_blank", "short_answer"]} selected={brief.types} disabled={!editable} onChange={(values) => setBrief({ ...brief, types: values as QuestionType[] })} />
        <BriefChecks label="Cognitive objectives" values={["knowledge", "comprehension", "application", "synthesis", "innovation"]} selected={brief.objectives} disabled={!editable} onChange={(values) => setBrief({ ...brief, objectives: values as Question["objective"][] })} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-6 py-4"><span className="text-xs text-slate-500">{selectedEntities.length} approved concepts · {brief.count} requested questions</span>{editable && <button disabled={!!busy || !brief.types.length || !brief.objectives.length} onClick={() => void act("Starting generation", async () => { await api(`/api/assignments/${assignmentId}/generate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...brief, coverageEntityIds: [] }) }); await onRefresh(); })} className="inline-flex items-center gap-2 rounded-lg bg-[#193b61] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Generate assessment <Sparkles className="size-4" /></button>}</div>
    </div>
    <aside className="sticky top-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#54738f]">Grounding</p><h3 className="mt-2 text-lg font-semibold text-[#142f4d]">Evidence stays attached</h3><p className="mt-1 text-xs leading-5 text-slate-500">Every generated question must point back to approved knowledge.</p><div className="mt-4 max-h-[520px] overflow-y-auto pr-1">{selectedEntities.map((entity) => <div key={entity.id} className="grid grid-cols-[18px_1fr] gap-x-2 border-b border-slate-100 py-3 text-xs"><CheckCircle2 className="size-4 text-emerald-600" /><span className="font-semibold text-slate-700">{entity.name}</span><small className="col-start-2 mt-1 text-[10px] text-slate-400">{entity.evidence[0]?.locator || "Course knowledge"}</small></div>)}</div></aside>
  </section>;
}

function BriefChecks({ label, values, selected, disabled, onChange }: { label: string; values: string[]; selected: string[]; disabled: boolean; onChange: (values: string[]) => void }) {
  return <fieldset><legend className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</legend><div className="mt-3 flex flex-wrap gap-2">{values.map((value) => { const active = selected.includes(value); return <button type="button" disabled={disabled} key={value} onClick={() => onChange(active ? selected.length > 1 ? selected.filter((item) => item !== value) : selected : [...selected, value])} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold capitalize disabled:opacity-50 ${active ? "border-[#9bb2c8] bg-[#edf4fa] text-[#193b61]" : "border-slate-200 bg-white text-slate-600"}`}>{active && <Check className="size-3.5" />}{value.replaceAll("_", " ")}</button>; })}</div></fieldset>;
}

function ChoiceOptionsEditor({ type, options, label, onChange }: { type: "single_choice" | "multi_choice"; options: string[]; label: string; onChange: (options: string[], removedIndex?: number) => void }) {
  const minimum = type === "single_choice" ? 2 : 3;
  return <fieldset>
    <legend className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Options</legend>
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      {options.map((option, index) => {
        const letter = String.fromCharCode(65 + index);
        return <div key={index} className="group flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 focus-within:border-[#9bb2c8] focus-within:ring-4 focus-within:ring-[#edf3f8]">
          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-slate-100 font-mono text-[10px] font-bold text-slate-600">{letter}</span>
          <input required aria-label={`${label} option ${letter}`} value={option} onChange={(event) => onChange(options.map((value, current) => current === index ? event.target.value : value))} placeholder={`Option ${letter}`} className="min-w-0 flex-1 bg-transparent text-sm font-normal text-slate-700 outline-none" />
          <button type="button" aria-label={`Delete option ${letter}`} disabled={options.length <= minimum} onClick={() => onChange(options.filter((_, current) => current !== index), index)} className="grid size-7 shrink-0 place-items-center rounded-md text-slate-300 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"><Trash2 className="size-3.5" /></button>
        </div>;
      })}
      <button type="button" disabled={options.length >= 26} onClick={() => onChange([...options, ""])} className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-3 py-2 text-xs font-semibold text-[#54738f] transition-colors hover:border-[#9bb2c8] hover:bg-[#e8eef4] hover:text-[#193b61] disabled:cursor-not-allowed disabled:opacity-40"><Plus className="size-3.5" />Add option</button>
    </div>
    <p className="mt-2 text-[10px] text-slate-400">{type === "single_choice" ? "Use one answer letter, for example A." : "Use comma-separated answer letters, for example A, C."}</p>
  </fieldset>;
}

function QuestionCard(props: { question: Question; index: number; count: number; locked: boolean; dirty: boolean; candidate?: Candidate; instruction: string; entities: Array<{ id: string; name: string }>; onInstruction: (value: string) => void; onChange: (value: Partial<Question>) => void; onMove: (delta: number) => void; onDelete: () => void; onRegenerate: () => void; onResolve: (action: "accept" | "reject") => void }) {
  const { question, locked } = props;
  const [editing, setEditing] = useState(() => !question.prompt && !locked);
  const [regenerating, setRegenerating] = useState(false);
  const conceptNames = question.entityIds.map((id) => props.entities.find((entity) => entity.id === id)?.name).filter(Boolean);
  const editLabel = "text-[10px] font-semibold uppercase tracking-wider text-slate-500";
  const editField = `mt-1 normal-case font-normal text-slate-700 ${field}`;
  return <article className={`grid overflow-hidden rounded-2xl border bg-white shadow-sm md:grid-cols-[54px_minmax(0,1fr)_44px] ${editing ? "border-[#9bb2c8] ring-1 ring-[#dbe7f2]" : "border-slate-200"}`}>
    <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-slate-400 md:flex-col md:border-r md:border-b-0 md:px-0 md:py-4"><GripVertical className="size-4" /><span className="font-mono text-xs font-bold text-slate-500">{String(props.index + 1).padStart(2, "0")}</span></div>
    <div className="min-w-0 p-5">
      <div className="mb-3 flex flex-wrap items-center gap-1.5"><span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[9px] font-bold uppercase text-slate-600">{question.type.replaceAll("_", " ")}</span><span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[9px] font-bold uppercase text-slate-600">{question.difficulty}</span><span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[9px] font-bold uppercase text-slate-600">{question.objective}</span><span className="rounded-md border border-slate-200 px-2 py-1 text-[9px] font-semibold text-slate-500">{question.origin === "teacher_authored" ? "Teacher authored" : "AI generated"}</span><b className="ml-auto text-xs text-[#193b61]">{question.score} pts</b></div>
      {editing ? <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-4"><label className={editLabel}>Type<select disabled={question.origin === "ai_generated"} value={question.type} onChange={(event) => { const type = event.target.value as QuestionType; props.onChange({ type, options: optionsForType(type, question.options), answer: type === question.type ? question.answer : "" }); }} className={editField}><option value="single_choice">Single choice</option><option value="multi_choice">Multiple choice</option><option value="fill_blank">Fill blank</option><option value="short_answer">Short answer</option></select></label><label className={editLabel}>Difficulty<select disabled={question.origin === "ai_generated"} value={question.difficulty} onChange={(event) => props.onChange({ difficulty: event.target.value as Question["difficulty"] })} className={editField}><option>easy</option><option>medium</option><option>hard</option></select></label><label className={editLabel}>Objective<select disabled={question.origin === "ai_generated"} value={question.objective} onChange={(event) => props.onChange({ objective: event.target.value as Question["objective"] })} className={editField}><option>knowledge</option><option>comprehension</option><option>application</option><option>synthesis</option><option>innovation</option></select></label><label className={editLabel}>Score<input type="number" min={1} max={100} value={question.score} onChange={(event) => props.onChange({ score: Number(event.target.value) })} className={editField}/></label></div>
        <label className={`block ${editLabel}`}>Prompt<textarea value={question.prompt} onChange={(event) => props.onChange({ prompt: event.target.value })} rows={3} className={editField}/></label>
        {(question.type === "single_choice" || question.type === "multi_choice") && <ChoiceOptionsEditor type={question.type} options={question.options} label={`Question ${props.index + 1}`} onChange={(options, removedIndex) => props.onChange({ options, ...(removedIndex === undefined ? {} : { answer: answerAfterOptionRemoval(question.answer, removedIndex) }) })} />}
        <div className="grid gap-3 md:grid-cols-2"><label className={editLabel}>Answer<input value={question.answer} onChange={(event) => props.onChange({ answer: event.target.value })} className={editField}/></label><label className={editLabel}>Explanation<textarea value={question.explanation} onChange={(event) => props.onChange({ explanation: event.target.value })} rows={2} className={editField}/></label></div>
      </div> : <>
        <p className="whitespace-pre-wrap text-sm font-semibold leading-6 text-[#142f4d]">{question.prompt || "Untitled question"}</p>
        {!!question.options.length && <div className="mt-3 grid gap-2 sm:grid-cols-2">{question.options.map((option, index) => <div key={`${question.id}-${index}`} className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs leading-5 text-slate-600"><span className="grid size-5 shrink-0 place-items-center rounded-md bg-slate-100 font-mono text-[9px] font-bold">{String.fromCharCode(65 + index)}</span><span>{option}</span></div>)}</div>}
        <details className="mt-4 border-t border-slate-200 pt-3"><summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-semibold text-slate-600">Answer & explanation <ChevronDown className="size-3.5" /></summary><strong className="mt-3 block text-xs text-[#193b61]">{question.answer}</strong><p className="mt-1 text-xs leading-5 text-slate-500">{question.explanation}</p></details>
      </>}
      <div className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-400"><FileText className="size-3.5" />Grounded in: {conceptNames.length ? conceptNames.join(", ") : question.origin === "teacher_authored" ? "optional" : `${question.evidenceRefs.length} evidence reference${question.evidenceRefs.length === 1 ? "" : "s"}`}</div>
      {(regenerating || props.candidate) && !locked && <div className="mt-4 rounded-xl border border-[#d8e5f3] bg-[#f6f9fc] p-4"><div><strong className="text-xs text-[#193b61]">Regenerate with additional guidance</strong><p className="mt-1 text-[10px] text-slate-500">Save local edits before requesting a candidate.</p></div><textarea value={props.instruction} onChange={(event) => props.onInstruction(event.target.value)} placeholder="Make it easier, use a practical scenario…" rows={2} className={`mt-3 ${field}`} />{props.candidate && <div className="mt-3 rounded-xl border border-[#c8d9e8] bg-white p-4"><span className="text-[9px] font-bold uppercase tracking-wider text-[#54738f]">Candidate preview</span><strong className="mt-2 block text-sm text-[#142f4d]">{props.candidate.payload.prompt}</strong><p className="mt-2 text-xs leading-5 text-slate-500">{props.candidate.payload.explanation}</p><div className="mt-3 flex gap-2"><button disabled={props.dirty} onClick={() => props.onResolve("reject")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-40">Reject</button><button disabled={props.dirty} onClick={() => props.onResolve("accept")} className="inline-flex items-center gap-1 rounded-lg bg-[#193b61] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"><Check className="size-3.5" />Accept</button></div></div>}<div className="mt-3 flex items-center justify-end gap-2"><button onClick={() => setRegenerating(false)} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-500">Cancel</button><button disabled={props.dirty || !props.instruction.trim()} onClick={props.onRegenerate} className="inline-flex items-center gap-1.5 rounded-lg bg-[#24496f] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"><RefreshCw className="size-3.5" />Generate candidate</button></div></div>}
    </div>
    <div className="flex items-center gap-1 border-t border-slate-200 bg-white px-3 py-2 md:flex-col md:border-l md:border-t-0 md:px-1 md:py-3">{!locked && <><button aria-label={editing ? `Finish editing question ${props.index + 1}` : `Edit question ${props.index + 1}`} onClick={() => setEditing((value) => !value)} className={`grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-[#e8eef4] hover:text-[#193b61] ${editing ? "bg-[#e8eef4] text-[#193b61]" : ""}`}>{editing ? <Check className="size-4" /> : <Pencil className="size-4" />}</button><button aria-label="Move up" disabled={props.index === 0} onClick={() => props.onMove(-1)} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-20"><ArrowUp className="size-4"/></button><button aria-label="Move down" disabled={props.index === props.count - 1} onClick={() => props.onMove(1)} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-20"><ArrowDown className="size-4"/></button><button aria-label="Regenerate question" onClick={() => setRegenerating((value) => !value)} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-[#e8eef4] hover:text-[#193b61]"><RefreshCw className="size-4"/></button><button aria-label="Delete" onClick={props.onDelete} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4"/></button></>}</div>
  </article>;
}

function ManualForm({ title, question, entities, onChange, onCancel, onSubmit }: { title: string; question: Question; entities: Array<{ id: string; name: string }>; onChange: (question: Question) => void; onCancel: () => void; onSubmit: () => void }) {
  function submit(event: FormEvent) { event.preventDefault(); onSubmit(); }
  return <form onSubmit={submit} className="mt-5 rounded-2xl border border-[#d8e5f3] bg-white p-5">
    <h2 className="font-semibold text-[#193b61]">{title}</h2>
    <div className="mt-3 grid gap-3 md:grid-cols-3">
      <select value={question.type} onChange={(event) => { const type = event.target.value as QuestionType; onChange({ ...question, type, options: optionsForType(type, question.options), answer: type === question.type ? question.answer : "" }); }} className={field}><option value="single_choice">Single choice</option><option value="multi_choice">Multiple choice</option><option value="fill_blank">Fill blank</option><option value="short_answer">Short answer</option></select>
      <select value={question.entityIds[0] || ""} onChange={(event) => onChange({ ...question, entityIds: event.target.value ? [event.target.value] : [] })} className={field}><option value="">No knowledge point</option>{entities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <input type="number" min={1} max={100} value={question.score} onChange={(event) => onChange({ ...question, score: Number(event.target.value) })} className={field}/>
    </div>
    <textarea required placeholder="Question prompt" value={question.prompt} onChange={(event) => onChange({ ...question, prompt: event.target.value })} className={`mt-3 ${field}`}/>
    {(question.type === "single_choice" || question.type === "multi_choice") && <div className="mt-3"><ChoiceOptionsEditor type={question.type} options={question.options} label="Replacement question" onChange={(options, removedIndex) => onChange({ ...question, options, ...(removedIndex === undefined ? {} : { answer: answerAfterOptionRemoval(question.answer, removedIndex) }) })} /></div>}
    <input required placeholder={question.type === "single_choice" ? "Answer letter, for example A" : question.type === "multi_choice" ? "Answer letters, for example A, C" : "Answer"} value={question.answer} onChange={(event) => onChange({ ...question, answer: event.target.value })} className={`mt-3 ${field}`}/>
    <textarea required placeholder="Explanation" value={question.explanation} onChange={(event) => onChange({ ...question, explanation: event.target.value })} className={`mt-3 ${field}`}/>
    <div className="mt-3 flex gap-2"><button type="submit" className="rounded-lg bg-[#193b61] px-4 py-2 text-sm font-semibold text-white">Create replacement</button><button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm font-semibold">Cancel</button></div>
  </form>;
}
