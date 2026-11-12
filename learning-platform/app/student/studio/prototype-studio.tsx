"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Code2,
  FileText,
  GitBranch,
  Lock,
  Monitor,
  PenTool,
  Rocket,
  RotateCcw,
  Server,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  一天线性流程 · 5 个 SDLC 阶段                                             */
/*  每个阶段只有一个任务；完成当前任务后，才解锁下一阶段。                    */
/* -------------------------------------------------------------------------- */

type StageId = "requirements" | "design" | "implement" | "test" | "handoff";

type Stage = {
  id: StageId;
  time: string;
  label: string;
  question: string;
  task: string;
  icon: LucideIcon;
};

const STAGES: Stage[] = [
  {
    id: "requirements",
    time: "09:00",
    label: "Requirements",
    question: "What must the MVP do?",
    task: "Pick the two must-have requirements.",
    icon: FileText,
  },
  {
    id: "design",
    time: "11:00",
    label: "Design",
    question: "How real should the prototype look?",
    task: "Lock the right fidelity for a user test.",
    icon: PenTool,
  },
  {
    id: "implement",
    time: "14:00",
    label: "Implement",
    question: "Where should the API key live?",
    task: "Place the key safely in the system.",
    icon: Code2,
  },
  {
    id: "test",
    time: "16:00",
    label: "Test",
    question: "Did we build the right thing?",
    task: "Fix the CTA and rerun the test.",
    icon: CheckCircle2,
  },
  {
    id: "handoff",
    time: "17:00",
    label: "Handoff",
    question: "What did one day teach us?",
    task: "Review the prototype handoff.",
    icon: Rocket,
  },
];

const NOTES = [
  {
    id: "live-seats",
    text: "Show live free seats.",
    tag: "FUNCTIONAL",
    correct: true,
    color: "bg-[#e6c65c]",
    rotate: "-rotate-1",
  },
  {
    id: "two-seconds",
    text: "Seat data updates within 2 seconds.",
    tag: "NON-FUNCTIONAL",
    correct: true,
    color: "bg-[#85b3d8]",
    rotate: "rotate-1",
  },
  {
    id: "leaderboard",
    text: "Weekly study leaderboard.",
    tag: "GROWTH",
    correct: false,
    color: "bg-[#c9e2f5]",
    rotate: "rotate-[1.5deg]",
  },
  {
    id: "avatars",
    text: "Animated profile avatars.",
    tag: "DELIGHT",
    correct: false,
    color: "bg-[#d9e9f7]",
    rotate: "-rotate-[1.5deg]",
  },
];

const FIX_OPTIONS = [
  { id: "available", label: "Available", sub: "Keep the current copy", correct: false },
  {
    id: "reserve",
    label: "Reserve this seat",
    sub: "Turn the status into an action",
    correct: true,
  },
  { id: "details", label: "View details", sub: "Hide booking one level deeper", correct: false },
];

const KEY_OPTIONS = [
  {
    id: "frontend",
    title: "Frontend / React",
    sub: "Write it into browser code",
    icon: Monitor,
    correct: false,
    feedback: "Frontend code ships to the browser, so the API key is public.",
  },
  {
    id: "backend",
    title: "Backend / .env",
    sub: "Store it in a server-side environment variable",
    icon: Server,
    correct: true,
    feedback: "Correct. The browser only sends requests; the key stays on the server.",
  },
  {
    id: "github",
    title: "Public GitHub",
    sub: "Commit it to a public repo",
    icon: GitBranch,
    correct: false,
    feedback: "Once pushed, treat it as leaked. Keys never belong in a public repo.",
  },
];

/* -------------------------------------------------------------------------- */
/*  背景                                                                      */
/* -------------------------------------------------------------------------- */


/* -------------------------------------------------------------------------- */
/*  顶部进度                                                                  */
/* -------------------------------------------------------------------------- */

function StageBar({
  active,
  canContinue,
}: {
  active: number;
  canContinue: boolean;
}) {
  return (
    <section aria-label="SDLC stage progress" className="mt-4 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-semibold text-[#2d5f8a]">One day at Studio 12</p>
        <p className="text-base font-semibold text-slate-500">
          Stage {active + 1} of {STAGES.length}
        </p>
      </div>

      <div className="relative">
        <div className="absolute left-[10%] right-[10%] top-[22px] h-[3px] bg-slate-100">
          <motion.div
            className="h-full bg-[#e08a75]"
            animate={{ width: `${(active / (STAGES.length - 1)) * 100}%` }}
            transition={{ type: "spring", stiffness: 220, damping: 28 }}
          />
        </div>

        <div className="relative grid grid-cols-5">
          {STAGES.map((stage, index) => {
            const current = index === active;
            const done = index < active || (current && canContinue);
            const StageIcon = stage.icon;

            return (
              <div
                key={stage.id}
                aria-current={current ? "step" : undefined}
                className="relative z-10 flex flex-col items-center text-center"
              >
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-xl border-2 transition-colors ${
                    current
                      ? "border-[#e08a75] bg-[#e08a75] text-white"
                      : done
                        ? "border-[#b7ddcc] bg-[#d6efe4] text-[#2f6e56]"
                        : "border-slate-200 bg-[#f4f7fb] text-slate-400"
                  }`}
                >
                  {done && !current ? (
                    <Check className="h-5 w-5" strokeWidth={3} />
                  ) : (
                    <StageIcon className="h-5 w-5" strokeWidth={2} />
                  )}
                </span>
                <span
                  className={`mt-2 text-base font-semibold ${
                    current || done ? "text-[#193b61]" : "text-slate-400"
                  }`}
                >
                  {stage.label}
                </span>
                <span className="mt-0.5 text-sm text-slate-400">{stage.time}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  舞台标题                                                                  */
/* -------------------------------------------------------------------------- */

function StageHeader({
  stage,
  active,
  canContinue,
  onNext,
}: {
  stage: Stage;
  active: number;
  canContinue: boolean;
  onNext: () => void;
}) {
  const Icon = stage.icon;
  const last = active === STAGES.length - 1;

  return (
    <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#e08a75] text-white">
          <Icon className="h-7 w-7" />
        </span>
        <div>
          <p className="text-sm font-semibold text-[#2d5f8a]">{stage.time}</p>
          <h2 className="text-3xl font-bold leading-none tracking-[-0.04em] sm:text-4xl">
            {stage.label}
          </h2>
          <p className="mt-1 text-base text-slate-500">{stage.question}</p>
        </div>
      </div>

      <div className="flex flex-col items-start gap-2 sm:max-w-[320px] sm:items-end sm:text-right">
        <p className="text-base font-semibold text-[#193b61]">{stage.task}</p>
        {!canContinue && <p className="text-sm text-slate-500">Complete the task to continue</p>}
        <button
          type="button"
          onClick={onNext}
          disabled={!canContinue}
          className="inline-flex items-center gap-2 rounded-xl bg-[#193b61] px-4 py-2.5 text-base font-semibold text-white transition hover:bg-[#284f77] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          {last ? (
            <>
              <RotateCcw className="h-4 w-4" />
              Restart
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Requirements                                                              */
/* -------------------------------------------------------------------------- */

function RequirementsStage({
  selected,
  setSelected,
}: {
  selected: string[];
  setSelected: (ids: string[]) => void;
}) {
  const correctIds = NOTES.filter((note) => note.correct).map((note) => note.id);
  const complete =
    selected.length === 2 && selected.every((id) => correctIds.includes(id));
  const hasWrong = selected.some((id) => !correctIds.includes(id));

  const toggle = (id: string) => {
    if (complete) return;
    setSelected(
      selected.includes(id)
        ? selected.filter((item) => item !== id)
        : [...selected, id],
    );
  };

  return (
    <div className="grid gap-3 lg:grid-cols-[0.72fr_1.28fr]">
      <div className="flex flex-col gap-3">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-[#eef2f6] p-3 text-[#193b61]">
          <div className="absolute right-0 top-0 bg-[#e08a75] px-2 py-1 text-[11px] font-bold tracking-[0.16em] text-[#193b61]">
            Client
          </div>
          <img
            src="/characters/makoto.png"
            alt="Makoto"
            width={520}
            height={780}
            className="mx-auto h-[250px] w-auto object-contain sm:h-[300px]"
            draggable={false}
          />
          <div className="border-t border-slate-200 pt-2">
            <p className="text-base font-bold">MAKOTO</p>
            <p className="mt-1 text-[12px] leading-relaxed text-[#193b61]/55">
              Student council president. She wants a prototype that helps students find seats fast, but the budget only covers the core version.
            </p>
          </div>
        </div>
      </div>

      <div className="relative rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold tracking-[0.2em] text-[#2d5f8a]">
              Brief wall / 09:00
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-[-0.04em]">
              Pick exactly two.
            </h3>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
              Pick one functional and one non-functional requirement. The rest can wait.
            </p>
          </div>
          <span
            className={`shrink-0 px-2 py-1 text-[11px] font-bold tracking-[0.12em] ${
              complete ? "bg-[#d6efe4] text-[#2f6e56]" : "bg-slate-100 text-slate-600"
            }`}
          >
            {complete ? "Brief locked" : `${selected.length} / 2 selected`}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {NOTES.map((note) => {
            const isSelected = selected.includes(note.id);
            return (
              <button
                key={note.id}
                type="button"
                onClick={() => toggle(note.id)}
                aria-pressed={isSelected}
                className={`${note.color} ${note.rotate} relative min-h-[128px] p-3 text-left text-[#193b61] shadow-[5px_5px_0_rgba(0,0,0,.28)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[7px_7px_0_rgba(0,0,0,.35)] ${
                  isSelected ? "ring-4 ring-[#e08a75] ring-offset-2 ring-offset-[#16324f]" : ""
                }`}
              >
                <span className="absolute left-1/2 top-0 h-3 w-14 -translate-x-1/2 -translate-y-1/2 bg-white" />
                {isSelected && (
                  <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#e08a75] text-[#193b61]">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
                <span className="text-[8px] font-bold tracking-[0.16em] text-[#193b61]/40">
                  {note.tag}
                </span>
                <span className="mt-2 block text-base font-bold leading-snug">
                  {note.text}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 min-h-8">
          <AnimatePresence mode="wait">
            {complete ? (
              <motion.div
                key="complete"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-l-2 border-emerald-400 bg-emerald-400/10 px-3 py-2 text-[13px] font-bold text-emerald-300"
              >
                Brief locked. Functional = what it does; non-functional = how well it does it.
              </motion.div>
            ) : hasWrong && selected.length === 2 ? (
              <motion.div
                key="wrong"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-l-2 border-[#e08a75] bg-[#e08a75]/10 px-3 py-2 text-[13px] font-bold text-[#b85a45]"
              >
                One of those is not part of the MVP. Drop the nice-to-have and try again.
              </motion.div>
            ) : (
              <motion.p
                key="hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[12px] text-slate-400"
              >
                Click a sticky note to add or remove it.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Design                                                                    */
/* -------------------------------------------------------------------------- */

function DesignPhone({ tier }: { tier: "wireframe" | "mockup" | "hifi" }) {
  const wire = tier === "wireframe";
  const hifi = tier === "hifi";

  return (
    <div className="relative w-[255px] rounded-[2.5rem] border-[6px] border-[#e2e8f0] bg-[#eef2f6] p-1.5 shadow-[0_20px_45px_-28px_rgba(15,39,64,0.35)]">
      <div className="absolute left-1/2 top-2 h-4 w-16 -translate-x-1/2 rounded-b-xl bg-[#eef2f6]" />
      <div
        className={`overflow-hidden rounded-[2rem] p-3 transition-colors ${
          wire ? "bg-[#e3e9f1] text-[#193b61]/45" : "bg-[#e2e8f0] text-[#193b61]"
        }`}
      >
        <div className={`h-2 w-14 rounded ${wire ? "bg-slate-200" : "bg-[#eef2f6]/70"}`} />
        <div className={`mt-2 h-2 w-24 rounded ${wire ? "bg-slate-200" : "bg-[#eef2f6]/35"}`} />

        <div
          className={`mt-4 rounded-xl border p-3 ${
            wire ? "border-dashed border-black/25 bg-white" : "border-black/10 bg-white shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`h-3 w-16 rounded ${
                wire ? "bg-slate-200" : "bg-[#d6efe4]"
              }`}
            />
            <span
              className={`h-3 w-6 rounded ${
                wire ? "bg-slate-200" : "bg-slate-200"
              }`}
            />
          </div>
          <div
            className={`mt-3 h-5 w-4/5 rounded ${
              wire ? "bg-slate-200" : "bg-[#eef2f6]/75"
            }`}
          />
          <div
            className={`mt-2 h-3 w-3/5 rounded ${
              wire ? "bg-slate-200" : "bg-[#eef2f6]/25"
            }`}
          />
          <div
            className={`mt-4 h-9 rounded ${
              wire ? "border border-dashed border-black/25 bg-transparent" : "bg-emerald-500"
            } ${hifi ? "shadow-lg shadow-emerald-500/25" : ""}`}
          />
        </div>

        <div className="mt-3 grid grid-cols-5 gap-1">
          {Array.from({ length: 15 }).map((_, index) => (
            <span
              key={index}
              className={`h-2.5 rounded-[2px] ${
                wire
                  ? "bg-slate-200"
                  : index === 7
                    ? "bg-[#e08a75]"
                    : [1, 4, 6, 11, 13].includes(index)
                      ? "bg-slate-200"
                      : "bg-[#d6efe4]"
              }`}
            />
          ))}
        </div>

        <div
          className={`mt-3 h-2 rounded ${
            wire ? "bg-slate-200" : "bg-slate-200"
          } ${hifi ? "w-3/4" : "w-1/2"}`}
        />
      </div>
    </div>
  );
}

function DesignStage({
  fidelity,
  setFidelity,
  locked,
  setLocked,
}: {
  fidelity: number;
  setFidelity: (value: number) => void;
  locked: boolean;
  setLocked: (value: boolean) => void;
}) {
  const tier = fidelity < 35 ? "wireframe" : fidelity <= 72 ? "mockup" : "hifi";
  const inSweetSpot = tier === "mockup";

  return (
    <div className="grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="flex flex-col gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <img
            src="/characters/joker.png"
            alt="Joker"
            width={315}
            height={535}
            className="mx-auto h-[190px] w-auto object-contain object-top"
            draggable={false}
          />
          <div className="mt-2 border-t border-slate-100 pt-2">
            <p className="text-[12px] font-semibold text-slate-400">You / Designer</p>
            <p className="text-base font-bold text-[#193b61]">Joker</p>
            <p className="mt-1 text-[13px] leading-5 text-slate-500">
              “We don&apos;t need a finished product. We need something Kasumi can react to.”
            </p>
          </div>
        </div>

      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold tracking-[0.2em] text-[#2d5f8a]">
              Fidelity lab / 11:00
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-[-0.04em]">
              Set the testing sweet spot.
            </h3>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
              Too rough and you learn nothing. Too polished and you waste time. Stop at Mockup.
            </p>
          </div>
          <span
            className={`shrink-0 px-2 py-1 text-[11px] font-bold tracking-[0.12em] ${
              locked ? "bg-[#d6efe4] text-[#2f6e56]" : "bg-slate-100 text-slate-600"
            }`}
          >
            {locked ? "Design locked" : tier}
          </span>
        </div>

        <div className="mt-5 grid items-center gap-5 sm:grid-cols-[auto_1fr]">
          <div className="flex justify-center">
            <DesignPhone tier={tier} />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold tracking-[0.18em] text-slate-400">
                Fidelity
              </p>
              <p className="text-lg font-bold text-[#2d5f8a]">{fidelity}%</p>
            </div>

            <div className="relative mt-2">
              <div className="absolute left-[35%] right-[28%] top-1 h-2 border-x border-[#85b3d8]/40 bg-[#85b3d8]/10" />
              <input
                type="range"
                min={0}
                max={100}
                value={fidelity}
                disabled={locked}
                onChange={(event) => setFidelity(Number(event.target.value))}
                aria-label="Prototype fidelity"
                className="relative z-10 w-full accent-[#e08a75] disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="mt-1 flex justify-between text-[8px] font-bold tracking-[0.12em] text-slate-400">
              <span>Wireframe</span>
              <span>Mockup</span>
              <span>Hi-fi</span>
            </div>

            <div
              className={`mt-4 border-l-2 px-3 py-2 text-[13px] font-bold ${
                inSweetSpot
                  ? "border-emerald-400 bg-emerald-400/10 text-emerald-300"
                  : "border-[#e08a75] bg-[#e08a75]/10 text-[#b85a45]"
              }`}
            >
              {inSweetSpot
                ? "Enough fidelity to test the flow. Lock it."
                : tier === "wireframe"
                  ? "Too rough — Kasumi would react to the sketch, not the product."
                  : "Too polished for today. You are spending time on pixels, not learning."}
            </div>

            <button
              type="button"
              disabled={!inSweetSpot || locked}
              onClick={() => setLocked(true)}
              className="mt-3 inline-flex items-center gap-2 bg-white px-4 py-2.5 text-[12px] font-bold tracking-[0.12em] text-[#193b61] transition hover:bg-[#e08a75] hover:text-[#193b61] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Lock className="h-3.5 w-3.5" />
              {locked ? "Design locked" : "Lock design"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Implement                                                                 */
/* -------------------------------------------------------------------------- */

function ImplementStage({
  choice,
  setChoice,
}: {
  choice: string | null;
  setChoice: (value: string) => void;
}) {
  const selected = KEY_OPTIONS.find((option) => option.id === choice);
  const complete = choice === "backend";

  return (
    <div className="grid gap-3 lg:grid-cols-[0.72fr_1.28fr]">
      <div className="flex flex-col gap-3">
        <div className="relative overflow-hidden border border-[#85b3d8]/40 bg-[#85b3d8]/10">
          <div className="h-[235px] w-full overflow-hidden border-b border-slate-200 bg-slate-200 sm:h-[270px]">
            <img
              src="/characters/futaba.png"
              alt="Futaba"
              width={498}
              height={475}
              className="h-auto w-full object-cover object-top"
              draggable={false}
            />
          </div>
          <div className="p-3">
            <p className="text-base font-bold">FUTABA</p>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
              Tech lead. She reviews your architecture, API, and where the key lives.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold tracking-[0.2em] text-[#2d5f8a]">
              Architecture board / 14:00
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-[-0.04em]">
              Where does the key live?
            </h3>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
              StudySpot&apos;s AI summary needs an LLM API. Choose a safe place for the key.
            </p>
          </div>
          <span
            className={`shrink-0 px-2 py-1 text-[11px] font-bold tracking-[0.12em] ${
              complete ? "bg-[#d6efe4] text-[#2f6e56]" : "bg-[#e08a75] text-[#193b61]"
            }`}
          >
            {complete ? "Secure" : "Choose one"}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border border-slate-200 bg-[#eef2f6]/30 p-3">
          {[
            { label: "Browser", icon: Monitor },
            { label: "Flask API", icon: Server },
            { label: "LLM API", icon: Sparkles },
          ].map((node, index) => {
            const Icon = node.icon;
            return (
              <div key={node.label} className="flex flex-1 items-center gap-2">
                <div className="flex flex-1 flex-col items-center gap-1 border border-slate-200 bg-white/[0.03] px-2 py-2">
                  <Icon className="h-4 w-4 text-[#2d5f8a]" />
                  <span className="text-[11px] font-bold tracking-[0.1em] text-slate-600">
                    {node.label}
                  </span>
                </div>
                {index < 2 && <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />}
              </div>
            );
          })}
        </div>

        <div className="mt-4 grid gap-2">
          {KEY_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = choice === option.id;
            const wrong = isSelected && !option.correct;
            return (
              <button
                key={option.id}
                type="button"
                disabled={complete}
                onClick={() => setChoice(option.id)}
                className={`flex items-center gap-3 border px-3 py-3 text-left transition ${
                  wrong
                    ? "border-[#e08a75] bg-[#e08a75]/15"
                    : isSelected && option.correct
                      ? "border-emerald-400 bg-emerald-400/10"
                      : "border-slate-200 bg-white/[0.03] hover:border-[#85b3d8] hover:bg-white/[0.06]"
                } disabled:cursor-default`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center ${
                    wrong
                      ? "bg-[#e08a75] text-[#193b61]"
                      : complete && option.correct
                        ? "bg-[#d6efe4] text-[#2f6e56]"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {complete && option.correct ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-bold text-[#193b61]">{option.title}</span>
                  <span className="mt-0.5 block text-[12px] text-slate-500">{option.sub}</span>
                </span>
                {wrong && <AlertTriangle className="h-4 w-4 shrink-0 text-[#2d5f8a]" />}
              </button>
            );
          })}
        </div>

        <div className="mt-3 min-h-12">
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`border-l-2 px-3 py-2 text-[13px] font-bold ${
                  selected.correct
                    ? "border-emerald-400 bg-emerald-400/10 text-emerald-300"
                    : "border-[#e08a75] bg-[#e08a75]/10 text-[#b85a45]"
                }`}
              >
                {selected.feedback}
                {selected.correct && (
                  <pre className="mt-2 overflow-hidden border border-slate-200 bg-[#eef2f6]/40 p-2 text-[11px] font-normal text-slate-600">
                    <code>OPENAI_API_KEY=sk-...{"\n"}.env → .gitignore</code>
                  </pre>
                )}
              </motion.div>
            ) : (
              <p className="text-[12px] text-slate-400">
                Think about what the browser can see.
              </p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Test                                                                      */
/* -------------------------------------------------------------------------- */

function TestStage({
  onComplete,
  onContinue,
}: {
  onComplete: () => void;
  onContinue: () => void;
}) {
  const [phase, setPhase] = useState<"test" | "fix" | "success">("test");
  const [wrong, setWrong] = useState<string | null>(null);
  const passed = phase === "success";

  const choose = (option: (typeof FIX_OPTIONS)[number]) => {
    if (option.correct) {
      setWrong(null);
      setPhase("success");
      onComplete();
    } else {
      setWrong(option.id);
    }
  };

  return (
    <>
      <div className="grid gap-3 lg:grid-cols-[0.8fr_1.15fr_0.85fr]">
        {/* Kasumi */}
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl overflow-hidden border border-[#85b3d8]/50 bg-[#e08a75]">
            <img
              src="/characters/kasumi.png"
              alt="Kasumi"
              width={750}
              height={750}
              className="h-[240px] w-full object-cover object-top"
              draggable={false}
            />
            <div className="bg-[#eef2f6] p-3 text-[#193b61]">
              <p className="text-base font-bold">KASUMI</p>
              <p className="mt-1 text-[12px] leading-relaxed text-[#193b61]/55">
                First-year student. She&apos;ll try your prototype and surface problems you missed.
              </p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.blockquote
              key={passed ? "after" : "before"}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="border-l-4 border-[#85b3d8] bg-[#eef2f6] p-3 text-[#193b61]"
            >
              <p className="text-sm font-bold leading-snug">
                {passed
                  ? "“Oh — now it’s obvious. I’d tap that.”"
                  : "“I thought ‘Available’ meant the seat was already saved for me. So I didn’t tap it.”"}
              </p>
            </motion.blockquote>
          </AnimatePresence>
        </div>

        {/* Phone */}
        <div className="flex flex-col items-center">
          <div className="mb-2 flex w-full items-center justify-between">
            <p className="text-[11px] font-bold tracking-[0.2em] text-slate-500">
              Prototype / StudySpot
            </p>
            <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.14em] text-[#2d5f8a]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#85b3d8]" />
              Kasumi is testing
            </p>
          </div>

          <div className="relative w-[245px] rounded-[2.5rem] border-[6px] border-[#e2e8f0] bg-[#eef2f6] p-1.5 shadow-[0_20px_45px_-28px_rgba(15,39,64,0.35)]">
            <div className="absolute left-1/2 top-2 z-20 h-4 w-16 -translate-x-1/2 rounded-b-xl bg-[#eef2f6]" />
            <div className="overflow-hidden rounded-[2rem] bg-[#e2e8f0] text-[#193b61]">
              <div className="flex items-center justify-between px-4 pb-1 pt-3 text-[11px] font-bold">
                <span>9:41</span>
                <span className="text-[#193b61]/45">5G ▯</span>
              </div>
              <div className="px-4 pb-4">
                <p className="text-[8px] font-bold tracking-[0.18em] text-[#193b61]/35">
                  StudySpot
                </p>
                <h3 className="text-xl font-bold tracking-[-0.04em]">Find a quiet seat</h3>
                <div className="mt-2 flex items-center justify-between border-b border-black/10 pb-2 text-[8px] font-bold tracking-[0.1em] text-[#193b61]/40">
                  <span>Library · 3F</span>
                  <span>Quiet zone</span>
                </div>

                <div className="mt-3 grid grid-cols-5 gap-1.5">
                  {Array.from({ length: 15 }).map((_, index) => (
                    <span
                      key={index}
                      className={`h-3 rounded-[2px] ${
                        index === 7
                          ? "bg-[#e08a75]"
                          : [1, 4, 6, 11, 13].includes(index)
                            ? "bg-slate-200"
                            : "bg-[#d6efe4]"
                      }`}
                    />
                  ))}
                </div>

                <div className="mt-3 border border-black/10 bg-white p-3 shadow-[3px_3px_0_rgba(0,0,0,.08)]">
                  <p className="text-[11px] font-bold tracking-[0.1em] text-emerald-700">
                    Free now
                  </p>
                  <p className="mt-1 text-base font-bold">Quiet zone · Window</p>
                  <p className="mt-0.5 text-[11px] text-[#193b61]/45">Power outlet · Seat 3F-12</p>

                  <button
                    type="button"
                    onClick={() => {
                      if (phase === "test") setPhase("fix");
                    }}
                    className={`relative mt-3 flex w-full items-center justify-center px-3 py-2.5 text-sm font-bold tracking-[0.08em] ${
                      passed ? "bg-[#e08a75] text-[#193b61]" : "bg-emerald-500 text-[#193b61]"
                    }`}
                  >
                    {passed ? (
                      <>
                        <Check className="mr-1.5 h-3.5 w-3.5" strokeWidth={3} />
                        Reserve this seat
                      </>
                    ) : (
                      "Available"
                    )}
                    {!passed && (
                      <img
                        src="/ui/alert.png"
                        alt=""
                        width={240}
                        height={240}
                        className="absolute -right-2 -top-4 h-8 w-8"
                        draggable={false}
                      />
                    )}
                  </button>
                  {passed && (
                    <p className="mt-2 flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      Seat held for 15 minutes
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3">
            {phase === "test" ? (
              <button
                type="button"
                onClick={() => setPhase("fix")}
                className="inline-flex items-center gap-2 bg-white px-3 py-2 text-[12px] font-bold tracking-[0.12em] text-[#193b61] hover:bg-[#e08a75] hover:text-[#193b61]"
              >
                Fix the label <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-emerald-400 px-3 py-2 text-[12px] font-bold tracking-[0.12em] text-[#193b61]">
                <Check className="h-3.5 w-3.5" strokeWidth={3} /> Test passed
              </span>
            )}
          </div>
        </div>

        {/* Futaba data */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold tracking-[0.2em] text-slate-500">
              Futaba / Test feed
            </p>
            <span
              className={`px-2 py-1 text-[8px] font-bold tracking-[0.12em] ${
                passed ? "bg-[#d6efe4] text-[#2f6e56]" : "bg-[#e08a75] text-[#193b61]"
              }`}
            >
              {passed ? "Pass" : "Blocked"}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Task success", value: passed ? "1 / 1" : "0 / 1" },
                { label: "Time on task", value: passed ? "8.4s" : "42.8s" },
              ].map((metric) => (
                <div key={metric.label} className="border border-slate-200 bg-[#eef2f6]/35 p-2">
                  <p className="text-[8px] font-bold tracking-[0.12em] text-slate-400">
                    {metric.label}
                  </p>
                  <p className="mt-1 text-xl font-bold text-[#2d5f8a]">{metric.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-2 border border-slate-200 bg-[#eef2f6]/40 p-2.5">
              <p className="text-[8px] font-bold tracking-[0.14em] text-slate-400">
                Blocker
              </p>
              <div className="mt-1 flex items-start gap-2">
                {!passed && (
                  <img
                    src="/ui/alert.png"
                    alt=""
                    width={240}
                    height={240}
                    className="h-7 w-7 shrink-0"
                    draggable={false}
                  />
                )}
                <p className="text-[13px] font-bold leading-snug">
                  {passed
                    ? "Label now tells Kasumi what happens next."
                    : "“Available” reads like a status, not an action."}
                </p>
              </div>
            </div>

            <div className="mt-2 flex items-start gap-2 border-l-2 border-[#85b3d8] bg-[#85b3d8]/10 p-2.5">
              <img
                src="/characters/futaba.png"
                alt=""
                width={498}
                height={475}
                className="h-12 w-12 shrink-0 object-contain"
                draggable={false}
              />
              <div>
                <p className="text-[8px] font-bold tracking-[0.12em] text-[#2d5f8a]">
                  Futaba
                </p>
                <p className="mt-0.5 text-[12px] font-bold leading-snug text-slate-600">
                  {passed ? "“Now the data makes sense.”" : "“The data doesn’t lie.”"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fix dialog */}
      <AnimatePresence>
        {phase === "fix" && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="fix-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#eef2f6]/80 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, y: 16, rotate: -1 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              className="relative w-full max-w-lg border-2 border-slate-200 bg-white p-4 shadow-[12px_12px_0_#e08a75] sm:p-6"
            >
              <div className="absolute -left-2 -top-2 h-6 w-6 bg-[#e08a75]" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold tracking-[0.22em] text-[#2d5f8a]">
                    Label lab / Test #01
                  </p>
                  <h3 id="fix-title" className="mt-1 text-3xl font-bold">
                    What should this button say?
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">
                    Kasumi read “Available” as a status, not an action.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPhase("test")}
                  aria-label="Close label lab"
                  className="flex h-8 w-8 shrink-0 items-center justify-center border border-slate-200 text-slate-500 hover:border-slate-200 hover:text-[#193b61]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 grid gap-2">
                {FIX_OPTIONS.map((option, index) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => choose(option)}
                    className="group flex items-center gap-3 border border-slate-200 bg-white/[0.03] px-3 py-3 text-left transition hover:border-[#85b3d8] hover:bg-[#e08a75]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-slate-200 text-[13px] font-bold text-slate-500 group-hover:border-slate-200 group-hover:text-[#193b61]">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-bold text-[#193b61]">{option.label}</span>
                      <span className="mt-0.5 block text-[12px] text-slate-500 group-hover:text-slate-600">
                        {option.sub}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-[#193b61]" />
                  </button>
                ))}
              </div>

              {wrong && (
                <p className="mt-3 border-l-2 border-[#e08a75] bg-[#e08a75]/10 px-3 py-2 text-[13px] text-[#b85a45]">
                  That does not clear up Kasumi&apos;s confusion. Pick a label that says what happens when you tap it.
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success reveal */}
      <AnimatePresence>
        {phase === "success" && (
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#eef2f6]/95 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, rotate: -1 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              className="w-full max-w-xl"
            >
              <div className="relative mx-auto aspect-[480/379] w-full">
                <img
                  src="/ui/bubble.png"
                  alt=""
                  width={480}
                  height={379}
                  className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,.6)]"
                  draggable={false}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-[58%] -rotate-1 border-2 border-black bg-[#eef2f6] px-2.5 py-3 text-center text-[#193b61] shadow-[5px_5px_0_#e08a75] sm:w-[52%] sm:px-4 sm:py-4">
                    <p className="text-[7px] font-bold tracking-[0.22em] text-[#193b61]/45 sm:text-[11px]">
                      Concept unlocked
                    </p>
                    <h3 className="mt-1 text-2xl font-bold leading-none tracking-[-0.07em] sm:text-4xl">
                      Validation
                    </h3>
                    <p className="mt-2 text-[11px] font-bold leading-snug sm:text-[12px]">
                      Validation: did we
                      <br />
                      build the right thing?
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={onContinue}
                  className="inline-flex items-center gap-2 bg-[#e08a75] px-5 py-3 text-sm font-bold tracking-[0.14em] text-[#193b61] hover:bg-white hover:text-[#193b61]"
                >
                  Continue to handoff
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Handoff                                                                   */
/* -------------------------------------------------------------------------- */

function HandoffStage({ onRestart }: { onRestart: () => void }) {
  const items = [
    { icon: FileText, label: "Requirements", value: "2 must-haves", note: "Functional + non-functional" },
    { icon: PenTool, label: "Design", value: "Mockup fidelity", note: "Enough to test, cheap to change" },
    { icon: Code2, label: "Implement", value: "Key in .env", note: "Browser never sees the secret" },
    { icon: CheckCircle2, label: "Test", value: "Validation passed", note: "Kasumi completed the task" },
  ];

  return (
    <div className="border border-slate-200 bg-white p-4 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-bold tracking-[0.24em] text-[#2d5f8a]">
            Project wall / 17:00
          </p>
          <h3 className="mt-1 text-3xl font-bold tracking-[-0.05em] sm:text-4xl">
            One day. One prototype.
          </h3>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-slate-500">
            You completed the full Requirements → Design → Implement → Test chain.
            The prototype now goes to the engineering team as the lifecycle moves on.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#2d5f8a]" />
          <span className="text-[12px] font-bold tracking-[0.18em] text-slate-500">
            Handoff complete
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.2 }}
              className="border border-slate-200 bg-white/[0.03] p-3"
            >
              <div className="flex items-center justify-between">
                <Icon className="h-4 w-4 text-[#2d5f8a]" />
                <Check className="h-4 w-4 text-emerald-400" strokeWidth={3} />
              </div>
              <p className="mt-3 text-[11px] font-bold tracking-[0.16em] text-slate-400">
                {item.label}
              </p>
              <p className="mt-1 text-base font-bold text-[#193b61]">{item.value}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{item.note}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col gap-3 border border-slate-200 bg-[#eef2f6]/30 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold tracking-[0.12em] text-slate-500">
          <span className="bg-[#e08a75] px-2 py-1 text-[#193b61]">Prototype</span>
          <ArrowRight className="h-3 w-3" />
          <span>Build</span>
          <ArrowRight className="h-3 w-3" />
          <span>Test</span>
          <ArrowRight className="h-3 w-3" />
          <span>Deploy</span>
          <ArrowRight className="h-3 w-3" />
          <span>Maintain</span>
          <span className="text-[#2d5f8a]">↺ Feedback</span>
        </div>
        <p className="text-[12px] font-bold text-slate-500">
          Prototype is how you learn. MVP is how you validate.
        </p>
      </div>

      <button
        type="button"
        onClick={onRestart}
        className="mt-4 inline-flex items-center gap-2 border border-slate-200 px-4 py-2.5 text-[12px] font-bold tracking-[0.14em] text-[#193b61] hover:bg-white hover:text-[#193b61]"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Run the day again
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  主组件                                                                    */
/* -------------------------------------------------------------------------- */

export default function PrototypeStudio() {
  const [active, setActive] = useState(0);
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const [fidelity, setFidelity] = useState(18);
  const [designLocked, setDesignLocked] = useState(false);
  const [keyChoice, setKeyChoice] = useState<string | null>(null);
  const [testComplete, setTestComplete] = useState(false);

  const stage = STAGES[active];
  const notesComplete =
    selectedNotes.length === 2 &&
    selectedNotes.every((id) => NOTES.find((note) => note.id === id)?.correct);

  const canContinue =
    active === 0
      ? notesComplete
      : active === 1
        ? designLocked
        : active === 2
          ? keyChoice === "backend"
          : active === 3
            ? testComplete
            : true;

  const resetAll = () => {
    setActive(0);
    setSelectedNotes([]);
    setFidelity(18);
    setDesignLocked(false);
    setKeyChoice(null);
    setTestComplete(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goNext = () => {
    if (!canContinue) return;
    if (active === STAGES.length - 1) {
      resetAll();
      return;
    }
    setActive(active + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };



  return (
    <div className="relative min-h-[calc(100vh-80px)] overflow-x-hidden bg-[#f4f7fb] text-[#193b61]">

      <div className="relative mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-[1280px] flex-col px-4 py-4 sm:px-6 lg:px-8">
        {/* Header */}

        <StageBar active={active} canContinue={canContinue} />
        <StageHeader active={active} canContinue={canContinue} onNext={goNext} stage={stage} />

        <div className="mt-3 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              {stage.id === "requirements" && (
                <RequirementsStage selected={selectedNotes} setSelected={setSelectedNotes} />
              )}
              {stage.id === "design" && (
                <DesignStage
                  fidelity={fidelity}
                  setFidelity={setFidelity}
                  locked={designLocked}
                  setLocked={setDesignLocked}
                />
              )}
              {stage.id === "implement" && (
                <ImplementStage choice={keyChoice} setChoice={setKeyChoice} />
              )}
              {stage.id === "test" && (
                <TestStage
                  onComplete={() => setTestComplete(true)}
                  onContinue={() => {
                    setTestComplete(true);
                    setActive(4);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              )}
              {stage.id === "handoff" && <HandoffStage onRestart={resetAll} />}
            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
