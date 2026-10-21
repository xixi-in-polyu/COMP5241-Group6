"use client";

import { Check, ChevronLeft, ChevronRight, Eye, GripVertical, Lightbulb, RotateCcw } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { InteractiveLabPublicActivity, InteractiveLabPublicPayload } from "@/lib/assignments/domain";

type SavedState = Record<string, unknown>;

export default function InteractiveLabRenderer({ payload, storageKey, onComplete, headerAction }: { payload: InteractiveLabPublicPayload; storageKey?: string; onComplete?: (complete: boolean) => void; headerAction?: ReactNode }) {
  const [state, setState] = useState<SavedState>({});
  const [ready, setReady] = useState(!storageKey);
  useEffect(() => {
    if (!storageKey) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try { setState(JSON.parse(localStorage.getItem(storageKey) || "{}")); } catch { setState({}); }
      setReady(true);
    });
    return () => { active = false; };
  }, [storageKey]);
  useEffect(() => {
    if (!storageKey || !ready) return;
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [ready, state, storageKey]);
  const update = (values: SavedState) => setState((current) => ({ ...current, ...values }));
  const reset = () => { setState({}); if (storageKey) localStorage.removeItem(storageKey); onComplete?.(false); };
  if (!ready) return <div className="rounded-xl border border-slate-200 p-5 text-sm text-slate-500">Loading practice…</div>;
  return <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-[#f7fafc] px-5 py-4">
      <div><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#54738f]">{payload.activity.type.replaceAll("_", " ")}</span><h3 className="mt-1 text-lg font-semibold text-[#142f4d]">{payload.activity.title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{payload.activity.instructions}</p></div>
      <div className="flex shrink-0 items-center gap-2">{headerAction}<button type="button" onClick={reset} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"><RotateCcw className="size-3.5"/>Reset</button></div>
    </header>
    <div className="p-5"><Activity activity={payload.activity} state={state} update={update} onComplete={onComplete} /></div>
  </article>;
}

function Activity({ activity, state, update, onComplete }: { activity: InteractiveLabPublicActivity; state: SavedState; update: (values: SavedState) => void; onComplete?: (complete: boolean) => void }) {
  switch (activity.type) {
    case "flashcards": return <Flashcards activity={activity} state={state} update={update} onComplete={onComplete}/>;
    case "matching": return <Matching activity={activity} state={state} update={update} onComplete={onComplete}/>;
    case "ordering": return <Ordering activity={activity} state={state} update={update} onComplete={onComplete}/>;
    case "categorization": return <Categorization activity={activity} state={state} update={update} onComplete={onComplete}/>;
    case "timeline": return <Timeline activity={activity} state={state} update={update} onComplete={onComplete}/>;
    case "slider_explorer": return <SliderExplorer activity={activity} state={state} update={update} onComplete={onComplete}/>;
    case "quick_check": return <QuickCheck activity={activity} state={state} update={update} onComplete={onComplete}/>;
  }
}

type ActivityOf<T extends InteractiveLabPublicActivity["type"]> = Extract<InteractiveLabPublicActivity, { type: T }>;
const completeBadge = <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"><Check className="size-3.5"/>Completed</p>;

function Flashcards({ activity, state, update, onComplete }: ActivityProps<"flashcards">) {
  const index = Math.min(Number(state.index || 0), activity.cards.length - 1); const flipped = Boolean(state.flipped); const seen = new Set(Array.isArray(state.seen) ? state.seen as string[] : []); const card = activity.cards[index];
  const visit = (next: number) => { const visited = new Set(seen); visited.add(activity.cards[next].id); const done = visited.size === activity.cards.length; update({ index: next, flipped: false, seen: [...visited], complete: done }); onComplete?.(done); };
  useEffect(() => { if (!seen.size) visit(0); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div><button type="button" onClick={() => update({ flipped: !flipped })} className="grid min-h-48 w-full place-items-center rounded-2xl border border-[#c8d9e8] bg-[#f4f8fb] p-8 text-center"><span><small className="text-[10px] font-bold uppercase tracking-wider text-[#54738f]">{flipped ? "Answer" : "Prompt"}</small><strong className="mt-3 block text-xl leading-8 text-[#193b61]">{flipped ? card.back : card.front}</strong><small className="mt-4 block text-slate-400">Click to flip</small></span></button><div className="mt-4 flex items-center justify-between"><button disabled={index === 0} onClick={() => visit(index - 1)} className="rounded-lg border p-2 disabled:opacity-30"><ChevronLeft className="size-4"/></button><span className="text-xs text-slate-500">{index + 1} / {activity.cards.length}</span><button disabled={index === activity.cards.length - 1} onClick={() => visit(index + 1)} className="rounded-lg border p-2 disabled:opacity-30"><ChevronRight className="size-4"/></button></div>{state.complete ? completeBadge : null}</div>;
}

type ActivityProps<T extends InteractiveLabPublicActivity["type"]> = { activity: ActivityOf<T>; state: SavedState; update: (values: SavedState) => void; onComplete?: (complete: boolean) => void };

function Matching({ activity, state, update, onComplete }: ActivityProps<"matching">) {
  const assignments = (state.assignments || {}) as Record<string, string>; const failed = Boolean(state.failed); const complete = Boolean(state.complete);
  const shuffledRight = useMemo(() => [...activity.pairs].sort((a, b) => a.right.localeCompare(b.right)), [activity.pairs]);
  const drop = (rightId: string, leftId: string) => update({ assignments: { ...assignments, [leftId]: rightId }, failed: false });
  const check = () => { const done = activity.pairs.every((pair) => assignments[pair.id] === pair.id); update({ complete: done, failed: !done }); onComplete?.(done); };
  return <div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2">{activity.pairs.map((pair) => <div key={pair.id} draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", pair.id)} className="cursor-grab rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-[#193b61]">{pair.left}</div>)}</div><div className="space-y-2">{shuffledRight.map((pair) => { const left = Object.entries(assignments).find(([, right]) => right === pair.id)?.[0]; return <div key={pair.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(pair.id, event.dataTransfer.getData("text/plain"))} className="min-h-12 rounded-xl border border-dashed border-[#9bb2c8] bg-[#f7fafc] p-3 text-sm text-slate-600">{pair.right}{left && <span className="mt-1 block text-[10px] font-semibold text-[#54738f]">Matched with {activity.pairs.find((item) => item.id === left)?.left}</span>}</div>; })}</div></div><Feedback failed={failed} complete={complete} hint={activity.hint} explanation={activity.explanation} hintShown={Boolean(state.hintShown)} answerShown={Boolean(state.answerShown)} onShowHint={() => update({ hintShown: true })} onShowAnswer={() => update({ answerShown: true })} answer={<ul className="space-y-1">{activity.pairs.map((pair) => <li key={pair.id}><span className="font-semibold">{pair.left}</span> → {pair.right}</li>)}</ul>}/><CheckButton onClick={check}/></div>;
}

function Ordering({ activity, state, update, onComplete }: ActivityProps<"ordering">) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const ids = Array.isArray(state.order) ? state.order as string[] : [...activity.items].reverse().map((item) => item.id); const failed = Boolean(state.failed); const complete = Boolean(state.complete);
  const itemRefs = useRef(new Map<string, HTMLDivElement>()); const previousPositions = useRef(new Map<string, DOMRect>()); const orderKey = ids.join("|");
  useLayoutEffect(() => { for (const [id, previous] of previousPositions.current) { if (id === draggingId) continue; const element = itemRefs.current.get(id); if (!element) continue; const current = element.getBoundingClientRect(); const offset = previous.top - current.top; if (offset) element.animate([{ transform: `translateY(${offset}px)` }, { transform: "translateY(0)" }], { duration: 170, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }); } previousPositions.current.clear(); }, [draggingId, orderKey]);
  const move = (from: string, to: string) => { const next = [...ids]; const fromIndex = next.indexOf(from); const toIndex = next.indexOf(to); if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return; previousPositions.current = new Map([...itemRefs.current].map(([id, element]) => [id, element.getBoundingClientRect()])); next.splice(toIndex, 0, next.splice(fromIndex, 1)[0]); update({ order: next, failed: false, complete: false }); onComplete?.(false); };
  const check = () => { const done = ids.every((id, index) => id === activity.items[index].id); update({ order: ids, complete: done, failed: !done }); onComplete?.(done); };
  return <div><p className="mb-3 flex items-center gap-1.5 text-xs text-slate-500"><GripVertical className="size-3.5"/>Drag an item through the list to place it. Other items move out of the way.</p><div className="space-y-2">{ids.map((id, index) => { const dragging = draggingId === id; return <div key={id} ref={(element) => { if (element) itemRefs.current.set(id, element); else itemRefs.current.delete(id); }} draggable aria-grabbed={dragging} onDragStart={(event) => { setDraggingId(id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", id); }} onDragEnter={(event) => { event.preventDefault(); const from = draggingId || event.dataTransfer.getData("text/plain"); if (from && from !== id) move(from, id); }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={(event) => { event.preventDefault(); setDraggingId(null); }} onDragEnd={() => setDraggingId(null)} className={`flex cursor-grab items-center gap-3 rounded-xl border bg-white p-3 transition-[opacity,box-shadow,border-color,scale] duration-150 active:cursor-grabbing ${dragging ? "scale-[1.015] border-[#7f9bb5] opacity-60 shadow-lg ring-4 ring-[#e8eef4]" : "border-slate-200 shadow-sm hover:border-[#b7cadc] hover:shadow"}`}><GripVertical aria-hidden="true" className={`size-4 shrink-0 ${dragging ? "text-[#24496f]" : "text-slate-300"}`}/><span className="grid size-7 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-[#385f88]">{index + 1}</span><span className="text-sm">{activity.items.find((item) => item.id === id)?.label}</span></div>; })}</div><Feedback failed={failed} complete={complete} hint={activity.hint} explanation={activity.explanation} hintShown={Boolean(state.hintShown)} answerShown={Boolean(state.answerShown)} onShowHint={() => update({ hintShown: true })} onShowAnswer={() => update({ answerShown: true })} answer={<ol className="list-inside list-decimal space-y-1">{activity.items.map((item) => <li key={item.id}>{item.label}</li>)}</ol>}/><CheckButton onClick={check}/></div>;
}

function Categorization({ activity, state, update, onComplete }: ActivityProps<"categorization">) {
  const placements = (state.placements || {}) as Record<string, string>; const failed = Boolean(state.failed); const complete = Boolean(state.complete);
  const place = (itemId: string, categoryId: string) => update({ placements: { ...placements, [itemId]: categoryId }, failed: false });
  const check = () => { const done = activity.items.every((item) => placements[item.id] === item.categoryId); update({ complete: done, failed: !done }); onComplete?.(done); };
  return <div><div className="flex flex-wrap gap-2">{activity.items.filter((item) => !placements[item.id]).map((item) => <span key={item.id} draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", item.id)} className="cursor-grab rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">{item.label}</span>)}</div><div className="mt-4 grid gap-3 md:grid-cols-2">{activity.categories.map((category) => <section key={category.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => place(event.dataTransfer.getData("text/plain"), category.id)} className="min-h-28 rounded-xl border border-dashed border-[#9bb2c8] bg-[#f7fafc] p-3"><h4 className="text-xs font-bold uppercase tracking-wider text-[#54738f]">{category.label}</h4><div className="mt-2 flex flex-wrap gap-2">{activity.items.filter((item) => placements[item.id] === category.id).map((item) => <span key={item.id} draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", item.id)} className="cursor-grab rounded-lg bg-white px-2.5 py-1.5 text-xs shadow-sm">{item.label}</span>)}</div></section>)}</div><Feedback failed={failed} complete={complete} hint={activity.hint} explanation={activity.explanation} hintShown={Boolean(state.hintShown)} answerShown={Boolean(state.answerShown)} onShowHint={() => update({ hintShown: true })} onShowAnswer={() => update({ answerShown: true })} answer={<div className="space-y-2">{activity.categories.map((category) => <div key={category.id}><span className="font-semibold">{category.label}:</span> {activity.items.filter((item) => item.categoryId === category.id).map((item) => item.label).join(", ")}</div>)}</div>}/><CheckButton onClick={check}/></div>;
}

function Timeline({ activity, state, update, onComplete }: ActivityProps<"timeline">) {
  const index = Math.min(Number(state.index || 0), activity.events.length - 1); const visited = new Set(Array.isArray(state.visited) ? state.visited as string[] : []); const event = activity.events[index];
  const visit = (next: number) => { const seen = new Set(visited); seen.add(activity.events[next].id); const done = seen.size === activity.events.length; update({ index: next, visited: [...seen], complete: done }); onComplete?.(done); };
  useEffect(() => { if (!visited.size) visit(0); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div><div className="rounded-2xl border border-[#c8d9e8] bg-[#f4f8fb] p-6"><span className="text-xs font-semibold text-[#54738f]">Event {index + 1} of {activity.events.length}</span><h4 className="mt-2 text-xl font-semibold text-[#193b61]">{event.label}</h4><p className="mt-3 text-sm leading-6 text-slate-600">{event.detail}</p></div><div className="mt-4 flex justify-between"><button disabled={index === 0} onClick={() => visit(index - 1)} className="rounded-lg border p-2 disabled:opacity-30"><ChevronLeft className="size-4"/></button><button disabled={index === activity.events.length - 1} onClick={() => visit(index + 1)} className="rounded-lg border p-2 disabled:opacity-30"><ChevronRight className="size-4"/></button></div>{state.complete ? completeBadge : null}</div>;
}

function SliderExplorer({ activity, state, update, onComplete }: ActivityProps<"slider_explorer">) {
  const checkpoints = [...activity.checkpoints].sort((a, b) => a.value - b.value); const index = Math.min(Number(state.index || 0), checkpoints.length - 1); const current = checkpoints[index]; const visited = new Set(Array.isArray(state.visited) ? state.visited as string[] : []);
  const select = (next: number) => { const bounded = Math.max(0, Math.min(checkpoints.length - 1, next)); const seen = new Set(visited); seen.add(checkpoints[bounded].id); const done = seen.size === checkpoints.length; update({ index: bounded, visited: [...seen], complete: done }); onComplete?.(done); };
  const chooseValue = (value: number) => select(checkpoints.reduce((best, item, currentIndex) => Math.abs(item.value - value) < Math.abs(checkpoints[best].value - value) ? currentIndex : best, 0));
  useEffect(() => { if (!visited.size) select(0); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div><div className="grid gap-3 sm:grid-cols-[1fr_130px]"><input aria-label="Explore checkpoint" type="range" min={0} max={checkpoints.length - 1} value={index} onChange={(event) => select(Number(event.target.value))} className="accent-[#193b61]"/><input aria-label="Checkpoint value" type="number" value={current.value} onChange={(event) => chooseValue(Number(event.target.value))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"/></div><div className="mt-4 rounded-2xl border border-[#c8d9e8] bg-[#f4f8fb] p-5"><span className="text-xs font-bold text-[#54738f]">{current.value}</span><h4 className="mt-1 text-lg font-semibold text-[#193b61]">{current.label}</h4><p className="mt-2 text-sm leading-6 text-slate-600">{current.explanation}</p></div>{state.complete ? completeBadge : null}</div>;
}

function QuickCheck({ activity, state, update, onComplete }: ActivityProps<"quick_check">) {
  const answers = (state.answers || {}) as Record<string, string>; const wrong = new Set(Array.isArray(state.wrong) ? state.wrong as string[] : []); const shownHints = new Set(Array.isArray(state.shownHints) ? state.shownHints as string[] : []); const shownAnswers = new Set(Array.isArray(state.shownAnswers) ? state.shownAnswers as string[] : []); const complete = Boolean(state.complete);
  const check = () => { const incorrect = activity.questions.filter((question) => answers[question.id] !== question.correctOptionId).map((question) => question.id); const done = incorrect.length === 0; update({ answers, wrong: incorrect, complete: done }); onComplete?.(done); };
  return <div className="space-y-5">{activity.questions.map((question, index) => <fieldset key={question.id}><legend className="text-sm font-semibold text-[#193b61]">{index + 1}. {question.prompt}</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{question.options.map((option) => <label key={option.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm"><input type="radio" name={question.id} checked={answers[question.id] === option.id} onChange={() => update({ answers: { ...answers, [question.id]: option.id } })}/>{option.label}</label>)}</div>{wrong.has(question.id) && <div><div className="flex flex-wrap items-center gap-x-4"><Hint text={question.hint} shown={shownHints.has(question.id)} onShow={() => update({ shownHints: [...shownHints, question.id] })}/><Answer text={question.options.find((option) => option.id === question.correctOptionId)?.label || ""} shown={shownAnswers.has(question.id)} onShow={() => update({ shownAnswers: [...shownAnswers, question.id] })}/></div></div>} {complete && <p className="mt-2 text-xs leading-5 text-emerald-700">{question.explanation}</p>}</fieldset>)}{complete ? completeBadge : null}<CheckButton onClick={check}/></div>;
}

function Feedback({ failed, complete, hint, explanation, hintShown, answerShown, onShowHint, onShowAnswer, answer }: { failed: boolean; complete: boolean; hint: string; explanation: string; hintShown: boolean; answerShown: boolean; onShowHint: () => void; onShowAnswer: () => void; answer: ReactNode }) {
  return <div>{failed && <><p role="status" className="mt-4 text-sm font-semibold text-amber-700">Not quite yet. Review your choices and try again.</p><div className="flex flex-wrap items-start gap-x-4"><Hint text={hint} shown={hintShown} onShow={onShowHint}/><Answer shown={answerShown} onShow={onShowAnswer}>{answer}</Answer></div></>}{complete && <p className="mt-4 text-sm leading-6 text-emerald-700">{explanation}</p>}</div>;
}

function Hint({ text, shown, onShow }: { text: string; shown: boolean; onShow: () => void }) { return shown ? <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800"><Lightbulb className="mt-0.5 size-4 shrink-0"/>{text}</p> : <button type="button" onClick={onShow} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700"><Lightbulb className="size-3.5"/>Show hint</button>; }
function Answer({ text, shown, onShow, children }: { text?: string; shown: boolean; onShow: () => void; children?: ReactNode }) { return shown ? <div className="mt-2 flex items-start gap-2 rounded-lg bg-sky-50 p-3 text-xs leading-5 text-sky-900"><Eye className="mt-0.5 size-4 shrink-0"/><div><span className="font-semibold">Correct answer</span>{text ? `: ${text}` : <div className="mt-1">{children}</div>}</div></div> : <button type="button" onClick={onShow} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700"><Eye className="size-3.5"/>Show answer</button>; }
function CheckButton({ onClick }: { onClick: () => void }) { return <button type="button" onClick={onClick} className="mt-4 rounded-lg bg-[#193b61] px-4 py-2.5 text-sm font-semibold text-white">Check answer</button>; }
