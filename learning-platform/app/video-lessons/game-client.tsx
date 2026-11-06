"use client";

import Image, { type StaticImageData } from "next/image";
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, GripVertical, HelpCircle, X } from "lucide-react";
import bossImage from "./resource/image/boss.jpeg";
import bossAngryImage from "./resource/image/bossa.jpeg";
import clientImage from "./resource/image/client.jpeg";
import clientAngryImage from "./resource/image/clienta.jpeg";

const introAudio = "/video-lessons/audio/g1n.mp3";
const correctAudio = "/video-lessons/audio/g1cb.mp3";
const wrongAudio = "/video-lessons/audio/g1wb.mp3?v=20261031-2142";
let activeGameAudio: HTMLAudioElement | null = null;

function stopActiveGameAudio() {
  if (!activeGameAudio) return;
  activeGameAudio.pause();
  activeGameAudio.currentTime = 0;
  activeGameAudio.load();
  activeGameAudio = null;
}

function registerGameAudio(audio: HTMLAudioElement) {
  stopActiveGameAudio();
  activeGameAudio = audio;
}
const gameTwoAudio = {
  1: { narration: "/video-lessons/audio/g2-1n.mp3", correct: "/video-lessons/audio/g2-1cc.mp3", wrong: "/video-lessons/audio/g2-1wb.mp3" },
  2: { narration: "/video-lessons/audio/g2-2n.mp3", correct: "/video-lessons/audio/g2-2cb.mp3", wrong: "/video-lessons/audio/g2-2wc.mp3" },
  3: { narration: "/video-lessons/audio/g2-3n.mp3", correct: "/video-lessons/audio/g1cb.mp3", wrong: "/video-lessons/audio/g4w.mp3" },
} as const;
const gameThreeAudio = {
  narration: "/video-lessons/audio/g3n.mp3",
  correct: "/video-lessons/audio/g3cc.mp3",
  wrong: "/video-lessons/audio/g3w.mp3",
};
const gameFourAudio = {
  narration: "/video-lessons/audio/g4n.mp3",
  correct: "/video-lessons/audio/g4c.mp3",
  wrong: "/video-lessons/audio/g4w.mp3",
};
const gameFiveAudio = {
  narration: "/video-lessons/audio/g5n.mp3",
  correct: "/video-lessons/audio/g1cb.mp3",
  wrong: "/video-lessons/audio/g4w.mp3",
};
const gameSixAudio = {
  narration: "/video-lessons/audio/g6n.mp3",
  correct: "/video-lessons/audio/g1cb.mp3",
  wrong: "/video-lessons/audio/g6w.mp3",
};
const endingAudio = {
  bothHigh: "/video-lessons/audio/e1.mp3",
  bossHighClientLow: "/video-lessons/audio/e2.mp3",
  bossLowClientHigh: "/video-lessons/audio/e3.mp3",
  bothLow: "/video-lessons/audio/e4.mp3",
};
const meterMaximum = 100;
const meterHighThreshold = 80;

type Bucket = "Must" | "Should" | "Could" | "Won't";
type Classification = "Functional" | "Non-Functional";
type Demand = {
  id: string;
  text: string;
  answer: Bucket;
  classification: Classification;
};
type GameTwoPart = 1 | 2 | 3;

const demands: Demand[] = [
  {
    id: "speed",
    text: "Translate dog barks to English in under 2 seconds",
    answer: "Must",
    classification: "Non-Functional",
  },
  {
    id: "blockchain",
    text: "Blockchain-based crypto collar integration",
    answer: "Won't",
    classification: "Functional",
  },
  {
    id: "login",
    text: "Allow users to login via email",
    answer: "Must",
    classification: "Functional",
  },
  {
    id: "dark-mode",
    text: "Dark mode that looks like a cyberpunk alleyway",
    answer: "Could",
    classification: "Non-Functional",
  },
];

const buckets: Bucket[] = ["Must", "Should", "Could", "Won't"];

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm">
      <div className="mb-1 flex justify-between text-xs font-bold uppercase tracking-wide text-[#193b61]">
        <span>{label}</span>
        <span>{value}/{meterMaximum}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${(value / meterMaximum) * 100}%` }} />
      </div>
    </div>
  );
}

function Character({
  src,
  alt,
  label,
}: {
  src: StaticImageData;
  alt: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <Image src={src} alt={alt} className="h-48 w-48 rounded-2xl object-cover shadow-md sm:h-56 sm:w-56" priority />
      <span className="rounded-full bg-[#193b61] px-4 py-1 text-sm font-bold text-white">{label}</span>
    </div>
  );
}

export default function GameClient() {
  const [started, setStarted] = useState(false);
  const [placements, setPlacements] = useState<Partial<Record<string, Bucket>>>({});
  const [classifications, setClassifications] = useState<Partial<Record<string, Classification>>>({});
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [greed, setGreed] = useState(50);
  const [delusion, setDelusion] = useState(50);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [retried, setRetried] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [game, setGame] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [performanceReview, setPerformanceReview] = useState(false);
  const introRef = useRef<HTMLAudioElement>(null);
  const reactionRef = useRef<HTMLAudioElement>(null);

  useEffect(() => () => stopActiveGameAudio(), []);

  function resetGame() {
    stopActiveGameAudio();
    setStarted(false);
    setPlacements({});
    setClassifications({});
    setFeedback(null);
    setGreed(50);
    setDelusion(50);
    setDraggedId(null);
    setRetried(false);
    setHelpOpen(false);
    setShowCorrectAnswer(false);
    setGame(1);
    setPerformanceReview(false);
  }

  const placedDemands = useMemo(
    () => new Set(Object.keys(placements)),
    [placements],
  );
  const completed = demands.every(
    (demand) =>
      placements[demand.id] === demand.answer &&
      classifications[demand.id] === demand.classification,
  );

  function startGame() {
    const audio = introRef.current;
    if (audio) {
      registerGameAudio(audio);
      audio.currentTime = 0;
      void audio.play().catch((error: unknown) => {
        console.warn("The game introduction audio could not start automatically.", error);
      });
    }
    setStarted(true);
  }

  function placeDemand(bucket: Bucket) {
    if (!draggedId) return;
    setPlacements((current) => ({ ...current, [draggedId]: bucket }));
    setDraggedId(null);
  }

  function submitAnswers() {
    if (feedback) return;
    stopActiveGameAudio();
    const correct = completed;
    setFeedback(correct ? "correct" : "wrong");
    if (!retried) {
      setGreed((value) => Math.max(0, Math.min(meterMaximum, value + (correct ? 10 : -10))));
      setDelusion((value) => Math.max(0, Math.min(meterMaximum, value + (correct ? 10 : -10))));
    }
    if (reactionRef.current) {
      registerGameAudio(reactionRef.current);
      reactionRef.current.src = correct ? correctAudio : wrongAudio;
      reactionRef.current.load();
      reactionRef.current.currentTime = 0;
      void reactionRef.current.play().catch((error: unknown) => {
        console.warn("The game reaction audio could not play.", error);
      });
    }
  }

  function redoGame() {
    stopActiveGameAudio();
    setPlacements({});
    setClassifications({});
    setFeedback(null);
    setDraggedId(null);
    setRetried(true);
    setShowCorrectAnswer(false);
  }

  if (performanceReview) {
    return <PerformanceReview greed={greed} delusion={delusion} onFinish={resetGame} />;
  }
  if (game === 2) {
    return <GameTwo greed={greed} delusion={delusion} setGreed={setGreed} setDelusion={setDelusion} setGame={setGame} />;
  }
  if (game === 3) {
    return <GameThree greed={greed} delusion={delusion} setGreed={setGreed} setDelusion={setDelusion} setGame={setGame} />;
  }
  if (game === 4) {
    return <GameFour greed={greed} delusion={delusion} setGreed={setGreed} setGame={setGame} />;
  }
  if (game === 5) {
    return <GameFive greed={greed} delusion={delusion} setGreed={setGreed} setGame={setGame} />;
  }
  if (game === 6) {
    return <GameSix greed={greed} delusion={delusion} setGreed={setGreed} setDelusion={setDelusion} setGame={setGame} setPerformanceReview={setPerformanceReview} />;
  }

  if (!started) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 text-slate-800">
        <div className="mx-auto max-w-5xl">
          <Link href="/student" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#193b61]">
            <ArrowLeft className="size-4" /> Back to student home
          </Link>
          <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-lg sm:p-14">
            <p className="text-sm font-semibold text-[#7791aa]">Software Development Life Cycle Survival Game</p>
            <h1 className="mt-2 text-3xl font-bold text-[#193b61]">What Does the Dog Say?</h1>
            <div className="mx-auto mt-8 grid max-w-3xl gap-5 text-left sm:grid-cols-3">
              <div className="rounded-2xl bg-amber-50 p-5"><h2 className="mb-2 font-bold text-amber-900">The Client</h2><p className="text-sm leading-6 text-amber-950">Wants to build an AI app that translates dog barks into human language, but specifically wants it to translate every single bark into &quot;I love you&quot;.</p></div>
              <div className="rounded-2xl bg-slate-100 p-5"><h2 className="mb-2 font-bold text-slate-900">The Boss</h2><p className="text-sm leading-6 text-slate-700">Wants the app built by Friday, for a budget of exactly $0.</p></div>
              <div className="rounded-2xl bg-blue-50 p-5"><h2 className="mb-2 font-bold text-blue-900">The Junior Dev (you)</h2><p className="text-sm leading-6 text-blue-950">The only thing standing between this company and total ruin.</p></div>
            </div>
            <p className="mx-auto mt-9 whitespace-nowrap text-base font-bold text-[#193b61] sm:text-lg">Make your boss richer, your client more delusional, and somehow don&apos;t get fired</p>
            <button type="button" onClick={startGame} className="mt-4 rounded-xl bg-[#193b61] px-8 py-3 font-bold text-white shadow-md transition hover:bg-[#244d78]">
              START
            </button>
          </section>
        </div>
        <audio ref={introRef} preload="auto" src={introAudio} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-3 text-slate-800 sm:p-5">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-4 flex items-center justify-between gap-3">
          <Link href="/student" className="inline-flex items-center gap-2 text-sm font-semibold text-[#193b61]"><ArrowLeft className="size-4" /> Exit game</Link>
          <h1 className="text-center text-xl font-bold text-[#193b61]">Game 1: Scope Creep Emergency</h1>
          <button type="button" onClick={() => setHelpOpen(true)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#193b61] hover:bg-slate-200"><HelpCircle className="size-4" /> Help</button>
        </header>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Meter label="Boss&apos;s Greed Meter" value={greed} color="bg-red-500" />
          <Meter label="Client&apos;s Delusion Meter" value={delusion} color="bg-purple-500" />
        </div>
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg sm:p-6">
          <div className="grid items-center gap-5 lg:grid-cols-[230px_minmax(0,1fr)_230px]">
            <Character src={feedback === "wrong" ? bossAngryImage : bossImage} alt="Boss character" label="Boss" />
            <div className={`order-first rounded-2xl border-2 border-dashed p-5 text-center lg:order-none ${
              feedback === "wrong"
                ? "border-red-300 bg-red-50"
                : feedback === "correct"
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-[#9bb8c9] bg-blue-50"
            }`}>
              {feedback === "wrong" ? (
                <p className="text-lg font-bold leading-7 text-red-800"><strong>Boss:</strong> &quot;You are FIRED! I&apos;m selling your desk on eBay!&quot;</p>
              ) : feedback === "correct" ? (
                <p className="text-lg font-bold leading-7 text-emerald-800"><strong>Boss:</strong> &quot;Good job.&quot;</p>
              ) : (
                <>
                  <p className="mb-4 text-sm leading-6 text-slate-700"><strong>Client:</strong> &quot;Hey! So for the app, it must translate dog barks to human language in under 2 seconds. It must have a blockchain-based crypto collar integration. It must allow users to log in via email. And it should have a dark mode that looks like a cyberpunk alleyway.&quot;</p>
                  <p className="text-sm leading-6 text-slate-700"><strong>Boss:</strong> &quot;Hold up! My budget is literally zero dollars. If we build blockchain, my AWS bill will bankrupt us. You, use the MoSCoW technique to categorize her demands right now so I don&apos;t fire you for scope creep.&quot;</p>
                </>
              )}
            </div>
            <Character src={feedback === "wrong" ? clientAngryImage : clientImage} alt="Client character" label="Client" />
          </div>
          <p className="my-6 text-center text-sm font-semibold text-[#193b61]">Drag each demand into its MoSCoW bucket, then identify whether it is Functional or Non-Functional.</p>
          <div className="grid gap-3 md:grid-cols-2">
            {buckets.map((bucket) => (
              <div key={bucket} onDragOver={(event) => event.preventDefault()} onDrop={() => placeDemand(bucket)} className="min-h-32 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-3">
                <h2 className="mb-2 font-bold text-[#193b61]">{bucket}</h2>
                <div className="space-y-2">
                  {demands.filter((demand) => placements[demand.id] === bucket).map((demand) => (
                    <div
                      key={demand.id}
                      draggable
                      onDragStart={() => setDraggedId(demand.id)}
                      className="cursor-grab rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm active:cursor-grabbing"
                    >
                      <p>{demand.text}</p>
                      <div className="mt-2 flex gap-2">
                        {(["Functional", "Non-Functional"] as Classification[]).map((kind) => <button key={kind} type="button" onClick={() => setClassifications((current) => ({ ...current, [demand.id]: kind }))} className={`rounded-lg px-2 py-1 text-xs font-semibold ${classifications[demand.id] === kind ? "bg-[#193b61] text-white" : "bg-slate-100 text-slate-600"}`}>{kind}</button>)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
            <h2 className="mb-2 font-bold text-[#193b61]">Unsorted demands</h2>
            <div className="grid gap-2 md:grid-cols-2">
              {demands.filter((demand) => !placedDemands.has(demand.id)).map((demand) => <div key={demand.id} draggable onDragStart={() => setDraggedId(demand.id)} className="flex cursor-grab items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm active:cursor-grabbing"><GripVertical className="mt-0.5 size-4 shrink-0 text-slate-400" />{demand.text}</div>)}
            </div>
          </div>
          <button type="button" onClick={submitAnswers} disabled={demands.some((demand) => !placements[demand.id] || !classifications[demand.id])} className="mt-5 w-full rounded-xl bg-[#193b61] px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Submit answers</button>
          {feedback === "wrong" && (
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={redoGame} className="rounded-lg bg-[#193b61] px-4 py-2 text-sm font-bold text-white shadow-sm">Redo</button>
              <button type="button" onClick={() => setShowCorrectAnswer(true)} className="rounded-lg border border-[#193b61] bg-white px-4 py-2 text-sm font-bold text-[#193b61] shadow-sm">Show correct answer</button>
            </div>
          )}
          {feedback === "correct" &&                               <button type="button" onClick={() => {
            stopActiveGameAudio();
            const audio = new Audio(gameTwoAudio[1].narration);
            registerGameAudio(audio);
            void audio.play().catch((error: unknown) => {
              console.warn("Game 2 Part 1 narration could not start automatically.", error);
            });
            setGame(2);
          }} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#193b61] px-5 py-3 font-bold text-white">Next: Game 2 <ChevronRight className="size-5" /></button>}
          {showCorrectAnswer && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-bold">Correct answers</p>
              <ul className="mt-2 space-y-1 text-left">
                {demands.map((demand) => <li key={demand.id}>{demand.text} — <strong>{demand.answer}</strong> / <strong>{demand.classification}</strong></li>)}
              </ul>
            </div>
          )}
        </section>
      </div>
      <audio ref={reactionRef} preload="auto" />
      {helpOpen && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="help-title">
          <section className="max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between"><h2 id="help-title" className="text-xl font-bold text-[#193b61]">MoSCoW and requirements</h2><button type="button" onClick={() => setHelpOpen(false)} aria-label="Close help"><X className="size-5" /></button></div>
            <p className="text-sm leading-6 text-slate-700">MoSCoW prioritizes requirements: <strong>Must</strong> items are essential for a usable release; <strong>Should</strong> items are important but have a workaround; <strong>Could</strong> items are useful extras; and <strong>Won&apos;t</strong> items are deliberately excluded from this release. [pp. 8–9]</p>
            <p className="mt-3 text-sm leading-6 text-slate-700"><strong>Functional requirements</strong> describe what the system does, such as logging in. <strong>Non-functional requirements</strong> describe qualities or constraints, such as response time, usability, or visual style. [pp. 10–11]</p>
          </section>
        </div>
      )}
    </main>
  );
}

type GameTwoProps = {
  greed: number;
  delusion: number;
  setGreed: Dispatch<SetStateAction<number>>;
  setDelusion: Dispatch<SetStateAction<number>>;
  setGame: Dispatch<SetStateAction<1 | 2 | 3 | 4 | 5 | 6>>;
};

const gameTwoParts = {
  1: {
    client: "I need to show the UI to my influencers tomorrow!",
    boss: "Show the client the user flow to get her to sign off on the UI before we write backend code. Buttons can be fake.",
    answer: "Throwaway Prototype",
    reaction: "Client: I clicked Buy Now and got a 404 error, but the vibe of the landing page was very chic. I’m investing.",
  },
  2: {
    client: "I also need to know if my followers will actually pay $10/month for this.",
    boss: "Build a landing page with a Buy Now button. When clicked, it says Coming Soon! and collects emails.",
    answer: "Minimum Viable Product (MVP)",
    reaction: "Boss: Brilliant. We validated the market with an MVP and spent $0.",
  },
  3: {
    client: "",
    boss: "Now build the core translation engine, and keep adding features to it until it’s the final product.",
    answer: "Evolutionary Prototype",
    reaction: "Boss: Good job.",
  },
} as const;

function GameTwo({ greed, delusion, setGreed, setDelusion, setGame }: GameTwoProps) {
  const [part, setPart] = useState<GameTwoPart>(1);
  const [choice, setChoice] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [retried, setRetried] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const narrationRef = useRef<HTMLAudioElement>(null);
  const reactionRef = useRef<HTMLAudioElement>(null);
  const current = gameTwoParts[part];
  const options = ["Throwaway Prototype", "Evolutionary Prototype", "Minimum Viable Product (MVP)"];

  function playAudio(src: string) {
    const audio = reactionRef.current;
    if (!audio) return;
    registerGameAudio(audio);
    audio.src = src;
    audio.load();
    audio.currentTime = 0;
    void audio.play().catch((error: unknown) => console.warn("Game 2 audio could not play.", error));
  }

  function startPart(nextPart: GameTwoPart) {
    stopActiveGameAudio();
    setPart(nextPart);
    setChoice("");
    setFeedback(null);
    setRetried(false);
    const audio = narrationRef.current;
    if (audio) {
      registerGameAudio(audio);
      audio.src = gameTwoAudio[nextPart].narration;
      audio.load();
      void audio.play().catch((error: unknown) => console.warn("Game 2 narration could not play.", error));
    }
  }

  function submit() {
    if (feedback || !choice) return;
    stopActiveGameAudio();
    const correct = choice === current.answer;
    setFeedback(correct ? "correct" : "wrong");
    if (!retried) {
      setGreed((value) => Math.max(0, Math.min(meterMaximum, value + (correct ? 5 : -5))));
      if (correct || part === 2) {
        setDelusion((value) => Math.max(0, Math.min(meterMaximum, value + (correct ? 5 : -5))));
      }
    }
    playAudio(correct ? gameTwoAudio[part].correct : gameTwoAudio[part].wrong);
  }

  function redo() {
    stopActiveGameAudio();
    setChoice("");
    setFeedback(null);
    setRetried(true);
  }

  return (
    <main className="min-h-screen bg-slate-100 p-3 text-slate-800 sm:p-5">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-4 flex items-center justify-between gap-3">
          <button type="button" onClick={() => { stopActiveGameAudio(); setGame(1); }} className="inline-flex items-center gap-2 text-sm font-semibold text-[#193b61]"><ArrowLeft className="size-4" /> Previous: Game 1</button>
          <h1 className="text-center text-xl font-bold text-[#193b61]">Game 2: The Reality Check</h1>
          <button type="button" onClick={() => setHelpOpen(true)} className="rounded-lg px-2 py-1 text-xs font-semibold text-[#193b61] hover:bg-slate-200"><HelpCircle className="inline size-4" /> Help</button>
        </header>
        <div className="mb-4 grid gap-3 sm:grid-cols-2"><Meter label="Boss&apos;s Greed Meter" value={greed} color="bg-red-500" /><Meter label="Client&apos;s Delusion Meter" value={delusion} color="bg-purple-500" /></div>
        <div className="mb-4 flex justify-center gap-2">{([1, 2, 3] as GameTwoPart[]).map((number) => <span key={number} className={`rounded-full px-4 py-2 text-sm font-bold ${number === part ? "bg-[#193b61] text-white" : "bg-white text-slate-500"}`}>Part {number}</span>)}</div>
        <section className={`rounded-3xl border-2 p-4 shadow-lg sm:p-6 ${feedback === "wrong" ? "border-red-300 bg-red-50" : feedback === "correct" ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}>
          <div className="grid items-center gap-5 lg:grid-cols-[230px_minmax(0,1fr)_230px]">
            <Character src={feedback === "wrong" ? bossAngryImage : bossImage} alt="Boss character" label="Boss" />
            <div className="order-first rounded-2xl border-2 border-dashed border-[#9bb8c9] bg-white/80 p-5 text-center lg:order-none">
              {feedback ? <p className={`text-lg font-bold leading-7 ${feedback === "correct" ? "text-emerald-800" : "text-red-800"}`}>{feedback === "correct" ? current.reaction : part === 2 ? "Client: You built the wrong product!" : part === 3 ? "Boss: You failed basic engineering. Go read the textbook!" : "Boss: You spent 3 weeks coding a functional backend?! We are bankrupt."}</p> : <><p className="mb-4 text-sm leading-6 text-slate-700">{current.client && <><strong>Client:</strong> {current.client}</>}</p><p className="text-sm leading-6 text-slate-700"><strong>Boss:</strong> {current.boss}</p></>}
            </div>
            <Character src={feedback === "wrong" && part !== 1 ? clientAngryImage : clientImage} alt="Client character" label="Client" />
          </div>
          <p className="my-6 text-center font-semibold text-[#193b61]">Choose what you build.</p>
          <div className="mx-auto grid max-w-3xl gap-3 md:grid-cols-3">{options.map((option) => <button key={option} type="button" disabled={Boolean(feedback)} onClick={() => setChoice(option)} className={`rounded-xl border-2 p-4 text-sm font-bold ${choice === option ? "border-[#193b61] bg-blue-100 text-[#193b61]" : "border-slate-200 bg-white text-slate-700"} disabled:cursor-not-allowed`}>{option}</button>)}</div>
          <button type="button" onClick={submit} disabled={!choice || Boolean(feedback)} className="mt-5 w-full rounded-xl bg-[#193b61] px-5 py-3 font-bold text-white disabled:opacity-40">Submit answer</button>
          {feedback === "wrong" && <div className="mt-5 flex justify-center gap-3"><button type="button" onClick={redo} className="rounded-lg bg-[#193b61] px-4 py-2 text-sm font-bold text-white">Redo</button>{part < 3 && <button type="button" onClick={() => startPart((part + 1) as GameTwoPart)} className="rounded-lg border border-[#193b61] bg-white px-4 py-2 text-sm font-bold text-[#193b61]">Next part</button>}</div>}
          {feedback === "correct" && <button type="button" onClick={() => {
            if (part < 3) {
              startPart((part + 1) as GameTwoPart);
              return;
            }
            stopActiveGameAudio();
            const audio = new Audio(gameThreeAudio.narration);
            registerGameAudio(audio);
            void audio.play().catch((error: unknown) => console.warn("Game 3 narration could not start automatically.", error));
            setGame(3);
          }} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#193b61] px-5 py-3 font-bold text-white">{part < 3 ? <>Next part <ChevronRight className="size-5" /></> : <>Next: Game 3 <ChevronRight className="size-5" /></>}</button>}
        </section>
        <audio ref={narrationRef} preload="auto" />
        <audio ref={reactionRef} preload="auto" />
        {helpOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="game-two-help-title"><section className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h2 id="game-two-help-title" className="text-xl font-bold text-[#193b61]">Prototype and MVP help</h2><button type="button" onClick={() => setHelpOpen(false)} aria-label="Close help"><X className="size-5" /></button></div><div className="space-y-3 text-sm leading-6 text-slate-700"><p><strong>Throwaway prototype:</strong> a quick model used to explore an interface or user flow. It can use fake buttons and is discarded after learning from it. <strong>[pp. 12–13]</strong></p><p><strong>Minimum Viable Product (MVP):</strong> the smallest usable product that tests whether real users want the idea. It should include only the essential features needed to validate demand. <strong>[pp. 14–15]</strong></p><p><strong>Evolutionary prototype:</strong> a working prototype that is gradually improved into the final system as requirements become clearer. <strong>[p. 16]</strong></p></div></section></div>}
      </div>
    </main>
  );
}

type GameThreeProps = {
  greed: number;
  delusion: number;
  setGreed: Dispatch<SetStateAction<number>>;
  setDelusion: Dispatch<SetStateAction<number>>;
  setGame: Dispatch<SetStateAction<1 | 2 | 3 | 4 | 5 | 6>>;
};

type SecurityOption = "A" | "B" | "C" | "D";

const securityOptions: Record<SecurityOption, string> = {
  A: "Hardcode it in App.js so the frontend can read it easily.",
  B: "Put it in a .env file and add .env to .gitignore.",
  C: "Push the .env file to the GitHub remote repository so Vercel can read it.",
  D: "Inject it securely via Vercel’s environment variable settings during deployment.",
};

function GameThree({ greed, delusion, setGreed, setDelusion, setGame }: GameThreeProps) {
  const [placements, setPlacements] = useState<Partial<Record<"Dev Environment" | "Production Environment", SecurityOption>>>({});
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [retried, setRetried] = useState(false);
  const [dragged, setDragged] = useState<SecurityOption | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const narrationRef = useRef<HTMLAudioElement>(null);
  const reactionRef = useRef<HTMLAudioElement>(null);
  const complete = placements["Dev Environment"] === "B" && placements["Production Environment"] === "D";

  function playAudio(src: string) {
    stopActiveGameAudio();
    const audio = reactionRef.current;
    if (!audio) return;
    registerGameAudio(audio);
    audio.src = src;
    audio.load();
    void audio.play().catch((error: unknown) => console.warn("Game 3 audio could not play.", error));
  }

  function place(environment: "Dev Environment" | "Production Environment") {
    if (!dragged) return;
    setPlacements((current) => ({ ...current, [environment]: dragged }));
    setDragged(null);
  }

  function submit() {
    if (feedback || !placements["Dev Environment"] || !placements["Production Environment"]) return;
    stopActiveGameAudio();
    const correct = complete;
    setFeedback(correct ? "correct" : "wrong");
    if (!retried) {
      setGreed((value) => Math.max(0, Math.min(meterMaximum, value + (correct ? 10 : -10))));
      setDelusion((value) => Math.max(0, Math.min(meterMaximum, value + (correct ? 10 : -10))));
    }
    playAudio(correct ? gameThreeAudio.correct : gameThreeAudio.wrong);
  }

  function redo() {
    stopActiveGameAudio();
    setPlacements({});
    setFeedback(null);
    setRetried(true);
  }

  return (
    <main className="min-h-screen bg-slate-100 p-3 text-slate-800 sm:p-5">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-4 flex items-center justify-between gap-3">
          <button type="button" onClick={() => { stopActiveGameAudio(); setGame(2); }} className="inline-flex items-center gap-2 text-sm font-semibold text-[#193b61]"><ArrowLeft className="size-4" /> Previous: Game 2</button>
          <h1 className="text-center text-xl font-bold text-[#193b61]">Game 3: Hide the Keys, Save the Company</h1>
          <button type="button" onClick={() => setHelpOpen(true)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#193b61] hover:bg-slate-200"><HelpCircle className="size-4" /> Help</button>
        </header>
        <div className="mb-4 grid gap-3 sm:grid-cols-2"><Meter label="Boss&apos;s Greed Meter" value={greed} color="bg-red-500" /><Meter label="Client&apos;s Delusion Meter" value={delusion} color="bg-purple-500" /></div>
        <section className={`rounded-3xl border-2 p-4 shadow-lg sm:p-6 ${feedback === "wrong" ? "border-red-300 bg-red-50" : feedback === "correct" ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}>
          <div className="grid items-center gap-5 lg:grid-cols-[230px_minmax(0,1fr)_230px]">
            <Character src={feedback === "wrong" ? bossAngryImage : bossImage} alt="Boss character" label="Boss" />
            <div className="rounded-2xl border-2 border-dashed border-[#9bb8c9] bg-white/80 p-5 text-center">
              {feedback ? <div className={`text-lg font-bold leading-7 ${feedback === "correct" ? "text-emerald-800" : "text-red-800"}`}>{feedback === "correct" ? <p>Client: My dog&apos;s secrets are safe with your .gitignore.</p> : <><p>Boss: A bot just mined 40,000 Dogecoins using our API key. The FBI is in the lobby. Pack your bags and get out!!!.</p><p className="mt-4">Client: My dog&apos;s bark just ordered 500 pizzas to my house. Fix this!</p></>}</div> : <><p className="mb-4 text-sm leading-6 text-slate-700"><strong>Boss:</strong> Okay, You&apos;re building the GenAI Chat App. The Backend (Flask) talks to OpenAI Azure. The Frontend (React) talks to the Backend. You just got the OpenAI API Key. How do we secure it so hackers don&apos;t steal it and I don&apos;t get a $10,000 bill?</p><p className="text-sm leading-6 text-slate-700"><strong>Client:</strong> Just make sure my doggo&apos;s secrets are safe, okay?</p></>}
            </div>
            <Character src={feedback === "wrong" ? clientAngryImage : clientImage} alt="Client character" label="Client" />
          </div>
          <p className="my-6 text-center font-semibold text-[#193b61]">Drag and drop to select the correct security steps for each environment.</p>
          <div className="mb-4 grid gap-3 md:grid-cols-2">{(["Dev Environment", "Production Environment"] as const).map((environment) => <div key={environment} onDragOver={(event) => event.preventDefault()} onDrop={() => place(environment)} className="min-h-28 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-3"><h2 className="font-bold text-[#193b61]">{environment}</h2>{placements[environment] && <div draggable onDragStart={() => setDragged(placements[environment] ?? null)} className="mt-2 cursor-grab rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm"><strong>[{placements[environment]}]</strong> {securityOptions[placements[environment] as SecurityOption]}</div>}</div>)}</div>
          <div className="grid gap-2 md:grid-cols-2">{(Object.keys(securityOptions) as SecurityOption[]).map((option) => <div key={option} draggable onDragStart={() => setDragged(option)} className="cursor-grab rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm"><strong>[{option}]</strong> {securityOptions[option]}</div>)}</div>
          <button type="button" onClick={submit} disabled={!placements["Dev Environment"] || !placements["Production Environment"] || Boolean(feedback)} className="mt-5 w-full rounded-xl bg-[#193b61] px-5 py-3 font-bold text-white disabled:opacity-40">Submit answer</button>
          {feedback === "wrong" && <button type="button" onClick={redo} className="mt-4 w-full rounded-xl border border-[#193b61] bg-white px-5 py-3 font-bold text-[#193b61]">Redo</button>}
          {feedback === "correct" && <button type="button" onClick={() => {
            stopActiveGameAudio();
            const audio = new Audio(gameFourAudio.narration);
            registerGameAudio(audio);
            void audio.play().catch((error: unknown) => console.warn("Game 4 narration could not start automatically.", error));
            setGame(4);
          }} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#193b61] px-5 py-3 font-bold text-white">Next: Game 4 <ChevronRight className="size-5" /></button>}
        </section>
        <audio ref={narrationRef} preload="auto" src={gameThreeAudio.narration} />
        <audio ref={reactionRef} preload="auto" />
      </div>
      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="game-three-help-title">
          <section className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 id="game-three-help-title" className="text-xl font-bold text-[#193b61]">Keeping API keys secure</h2>
              <button type="button" onClick={() => setHelpOpen(false)} aria-label="Close help"><X className="size-5" /></button>
            </div>
            <div className="space-y-4 text-sm leading-6 text-slate-700">
              <p><strong>Why this matters:</strong> an API key is a secret credential. If it is exposed in frontend code or committed to GitHub, other people can copy it and use the service at the company&apos;s expense.</p>
              <p><strong>Development environment:</strong> put the key in a local <code className="rounded bg-slate-100 px-1">.env</code> file and add that file to <code className="rounded bg-slate-100 px-1">.gitignore</code>. This keeps the local secret out of version control. Never push the <code className="rounded bg-slate-100 px-1">.env</code> file to the remote repository. <strong>[p. 21]</strong></p>
              <p><strong>Production environment:</strong> do not copy the key into <code className="rounded bg-slate-100 px-1">App.js</code> or any other public frontend file. Add it through Vercel&apos;s protected environment-variable settings so it is injected during deployment without being exposed to users. <strong>[p. 22]</strong></p>
              <p><strong>Watch out for:</strong> putting a secret in frontend code exposes it to users, while committing a secret file to the repository publishes the credential.</p>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

type GameFourProps = {
  greed: number;
  delusion: number;
  setGreed: Dispatch<SetStateAction<number>>;
  setGame: Dispatch<SetStateAction<1 | 2 | 3 | 4 | 5 | 6>>;
};

const gameFourOptions = {
  A: "Verification Passed, Validation Passed.",
  B: "Verification Failed, Validation Failed.",
  C: "Verification Passed, Validation Failed.",
  D: "Verification Failed, Validation Passed.",
} as const;

type GameFourOption = keyof typeof gameFourOptions;

function GameFour({ greed, delusion, setGreed, setGame }: GameFourProps) {
  const [choice, setChoice] = useState<GameFourOption | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [retried, setRetried] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const reactionRef = useRef<HTMLAudioElement>(null);

  function submit() {
    if (feedback || !choice) return;
    stopActiveGameAudio();
    const correct = choice === "C";
    setFeedback(correct ? "correct" : "wrong");
    if (!retried) {
      setGreed((value) => Math.max(0, Math.min(meterMaximum, value + (correct ? 5 : -5))));
    }
    const audio = reactionRef.current;
    if (!audio) return;
    registerGameAudio(audio);
    audio.src = correct ? gameFourAudio.correct : gameFourAudio.wrong;
    audio.load();
    void audio.play().catch((error: unknown) => console.warn("Game 4 reaction audio could not play.", error));
  }

  function redo() {
    stopActiveGameAudio();
    setChoice(null);
    setFeedback(null);
    setRetried(true);
  }

  return (
    <main className="min-h-screen bg-slate-100 p-3 text-slate-800 sm:p-5">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-4 flex items-center justify-between gap-3">
          <button type="button" onClick={() => { stopActiveGameAudio(); setGame(3); }} className="inline-flex items-center gap-2 text-sm font-semibold text-[#193b61]"><ArrowLeft className="size-4" /> Previous: Game 3</button>
          <h1 className="text-center text-xl font-bold text-[#193b61]">Game 4: Verification vs. Validation</h1>
          <button type="button" onClick={() => setHelpOpen(true)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#193b61] hover:bg-slate-200"><HelpCircle className="size-4" /> Help</button>
        </header>
        <div className="mb-4 grid gap-3 sm:grid-cols-2"><Meter label="Boss&apos;s Greed Meter" value={greed} color="bg-red-500" /><Meter label="Client&apos;s Delusion Meter" value={delusion} color="bg-purple-500" /></div>
        <section className={`rounded-3xl border-2 p-4 shadow-lg sm:p-6 ${feedback === "wrong" ? "border-red-300 bg-red-50" : feedback === "correct" ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}>
          <div className="grid items-center gap-5 lg:grid-cols-[230px_minmax(0,1fr)_230px]">
            <Character src={feedback === "wrong" ? bossAngryImage : bossImage} alt="Boss character" label="Boss" />
            <div className="order-first rounded-2xl border-2 border-dashed border-[#9bb8c9] bg-white/80 p-5 text-center lg:order-none">
              {feedback ? <p className={`text-lg font-bold leading-7 ${feedback === "correct" ? "text-emerald-800" : "text-red-800"}`}>{feedback === "correct" ? "Client: You built the product right, but it's the wrong product!" : "Boss: You failed basic engineering. Go read the textbook."}</p> : <><p className="mb-4 text-sm leading-6 text-slate-700"><strong>Client:</strong> The app is live! I tested it. The AI translated my doggo&apos;s bark into: &quot;I require 500 pounds of premium wagyu beef.&quot;, but I wanted it to say &quot;I love you&quot;, so I would feel good! I&apos;m not buying this!</p><p className="text-sm leading-6 text-slate-700"><strong>Boss:</strong> Wait, but the code successfully connects to the AI, processes the audio, and responds without crashing, right? The system test passed! You, analyze this. What is the status of our software?</p></>}
            </div>
            <Character src={feedback === "wrong" ? clientAngryImage : clientImage} alt="Client character" label="Client" />
          </div>
          <p className="my-6 text-center font-semibold text-[#193b61]">Choose the correct status of the software based on Verification and Validation.</p>
          <div className="mx-auto grid max-w-3xl gap-3 md:grid-cols-2">{(Object.keys(gameFourOptions) as GameFourOption[]).map((option) => <button key={option} type="button" disabled={Boolean(feedback)} onClick={() => setChoice(option)} className={`rounded-xl border-2 p-4 text-left text-sm font-bold ${choice === option ? "border-[#193b61] bg-blue-100 text-[#193b61]" : "border-slate-200 bg-white text-slate-700"} disabled:cursor-not-allowed`}><strong>[{option}]</strong> {gameFourOptions[option]}</button>)}</div>
          <button type="button" onClick={submit} disabled={!choice || Boolean(feedback)} className="mt-5 w-full rounded-xl bg-[#193b61] px-5 py-3 font-bold text-white disabled:opacity-40">Submit answer</button>
          {feedback === "wrong" && <button type="button" onClick={redo} className="mt-4 w-full rounded-xl border border-[#193b61] bg-white px-5 py-3 font-bold text-[#193b61]">Redo</button>}
          {feedback === "correct" && <button type="button" onClick={() => {
            stopActiveGameAudio();
            const audio = new Audio(gameFiveAudio.narration);
            registerGameAudio(audio);
            void audio.play().catch((error: unknown) => console.warn("Game 5 narration could not start automatically.", error));
            setGame(5);
          }} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#193b61] px-5 py-3 font-bold text-white">Next: Game 5 <ChevronRight className="size-5" /></button>}
        </section>
        <audio ref={reactionRef} preload="auto" />
      </div>
      {helpOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="game-four-help-title"><section className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-4 flex items-center justify-between gap-4"><h2 id="game-four-help-title" className="text-xl font-bold text-[#193b61]">Verification vs Validation</h2><button type="button" onClick={() => setHelpOpen(false)} aria-label="Close help"><X className="size-5" /></button></div><div className="space-y-4 text-sm leading-6 text-slate-700"><p><strong>Verification</strong> checks whether the software is being built correctly against its specified requirements. Code reviews, unit tests, integration tests, and system tests are examples. It asks: are we building the product right?</p><p><strong>Validation</strong> checks whether the finished software meets the user&apos;s or business&apos;s real needs. Prototyping, acceptance testing, usability testing, production testing, and A/B testing are examples. It asks: are we building the right product?</p><p>A system can pass verification while failing validation: the implementation may work technically, but the result may not satisfy what the user actually wanted. <strong>[p. 33]</strong></p></div></section></div>}
    </main>
  );
}

type GameFiveProps = {
  greed: number;
  delusion: number;
  setGreed: Dispatch<SetStateAction<number>>;
  setGame: Dispatch<SetStateAction<1 | 2 | 3 | 4 | 5 | 6>>;
};

const gameFiveOptions = ["Unit Testing", "Integration Testing", "Regression Testing", "System Testing"] as const;
type GameFiveOption = (typeof gameFiveOptions)[number];

function GameFive({ greed, delusion, setGreed, setGame }: GameFiveProps) {
  const [choice, setChoice] = useState<GameFiveOption | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [retried, setRetried] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const reactionRef = useRef<HTMLAudioElement>(null);

  function submit() {
    if (feedback || !choice) return;
    stopActiveGameAudio();
    const correct = choice === "Regression Testing";
    setFeedback(correct ? "correct" : "wrong");
    if (!retried) {
      setGreed((value) => Math.max(0, Math.min(meterMaximum, value + (correct ? 5 : -5))));
    }
    const audio = reactionRef.current;
    if (!audio) return;
    registerGameAudio(audio);
    audio.src = correct ? gameFiveAudio.correct : gameFiveAudio.wrong;
    audio.load();
    void audio.play().catch((error: unknown) => console.warn("Game 5 reaction audio could not play.", error));
  }

  function redo() {
    stopActiveGameAudio();
    setChoice(null);
    setFeedback(null);
    setRetried(true);
  }

  return (
    <main className="min-h-screen bg-slate-100 p-3 text-slate-800 sm:p-5">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-4 flex items-center justify-between gap-3">
          <button type="button" onClick={() => { stopActiveGameAudio(); setGame(4); }} className="inline-flex items-center gap-2 text-sm font-semibold text-[#193b61]"><ArrowLeft className="size-4" /> Previous: Game 4</button>
          <h1 className="text-center text-xl font-bold text-[#193b61]">Game 5: The Regression Catastrophe</h1>
          <button type="button" onClick={() => setHelpOpen(true)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#193b61] hover:bg-slate-200"><HelpCircle className="size-4" /> Help</button>
        </header>
        <div className="mb-4 grid gap-3 sm:grid-cols-2"><Meter label="Boss&apos;s Greed Meter" value={greed} color="bg-red-500" /><Meter label="Client&apos;s Delusion Meter" value={delusion} color="bg-purple-500" /></div>
        <section className={`rounded-3xl border-2 p-4 shadow-lg sm:p-6 ${feedback === "wrong" ? "border-red-300 bg-red-50" : feedback === "correct" ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}>
          <div className="grid items-center gap-5 lg:grid-cols-[230px_minmax(0,1fr)_230px]">
            <Character src={feedback === "wrong" ? bossAngryImage : bossImage} alt="Boss character" label="Boss" />
            <div className="order-first rounded-2xl border-2 border-dashed border-[#9bb8c9] bg-white/80 p-5 text-center lg:order-none">
              {feedback ? <p className={`text-lg font-bold leading-7 ${feedback === "correct" ? "text-emerald-800" : "text-red-800"}`}>{feedback === "correct" ? "Boss: Good job." : "Boss: You failed basic engineering. Go read the textbook!"}</p> : <p className="text-sm leading-6 text-slate-700"><strong>Boss:</strong> Disaster! You fixed a tiny bug in the &quot;Dog Profile&quot; module, and now when users click &quot;Login&quot;, the whole app crashes! What type of testing should have caught this before it went to the client?</p>}
            </div>
            <Character src={feedback === "wrong" ? clientAngryImage : clientImage} alt="Client character" label="Client" />
          </div>
          <p className="my-6 text-center font-semibold text-[#193b61]">The type of test I should conduct:</p>
          <div className="mx-auto grid max-w-3xl gap-3 md:grid-cols-2">{gameFiveOptions.map((option) => <button key={option} type="button" disabled={Boolean(feedback)} onClick={() => setChoice(option)} className={`rounded-xl border-2 p-4 text-left text-sm font-bold ${choice === option ? "border-[#193b61] bg-blue-100 text-[#193b61]" : "border-slate-200 bg-white text-slate-700"} disabled:cursor-not-allowed`}>{option}</button>)}</div>
          <button type="button" onClick={submit} disabled={!choice || Boolean(feedback)} className="mt-5 w-full rounded-xl bg-[#193b61] px-5 py-3 font-bold text-white disabled:opacity-40">Submit answer</button>
          {feedback === "wrong" && <button type="button" onClick={redo} className="mt-4 w-full rounded-xl border border-[#193b61] bg-white px-5 py-3 font-bold text-[#193b61]">Redo</button>}
          {feedback === "correct" && <button type="button" onClick={() => {
            stopActiveGameAudio();
            const audio = new Audio(gameSixAudio.narration);
            registerGameAudio(audio);
            void audio.play().catch((error: unknown) => console.warn("Game 6 narration could not start automatically.", error));
            setGame(6);
          }} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#193b61] px-5 py-3 font-bold text-white">Next: Game 6 <ChevronRight className="size-5" /></button>}
        </section>
        <audio ref={reactionRef} preload="auto" />
      </div>
      {helpOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="game-five-help-title"><section className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-4 flex items-center justify-between gap-4"><h2 id="game-five-help-title" className="text-xl font-bold text-[#193b61]">Testing</h2><button type="button" onClick={() => setHelpOpen(false)} aria-label="Close help"><X className="size-5" /></button></div><div className="space-y-4 text-sm leading-6 text-slate-700"><p><strong>Regression testing</strong> reruns existing tests after a bug fix or new feature to check that previously working areas have not been broken by the change. <strong>[p. 27]</strong></p><p><strong>Unit testing</strong> checks an individual component in isolation. <strong>[p. 23]</strong> <strong>Integration testing</strong> checks whether combined modules work together. <strong>[p. 24]</strong> <strong>System testing</strong> checks the complete system against its requirements. <strong>[p. 25]</strong></p><p>When a change to the Dog Profile module causes Login to crash, rerunning tests for existing functionality is the appropriate safeguard.</p></div></section></div>}
    </main>
  );
}

type GameSixProps = {
  greed: number;
  delusion: number;
  setGreed: Dispatch<SetStateAction<number>>;
  setDelusion: Dispatch<SetStateAction<number>>;
  setGame: Dispatch<SetStateAction<1 | 2 | 3 | 4 | 5 | 6>>;
  setPerformanceReview: Dispatch<SetStateAction<boolean>>;
};

const gameSixOptions = {
  A: "Big Bang",
  B: "Rolling Upgrade",
  C: "Blue-Green Deployment",
  D: "Canary",
} as const;

type GameSixOption = keyof typeof gameSixOptions;

function GameSix({ greed, delusion, setGreed, setDelusion, setGame, setPerformanceReview }: GameSixProps) {
  const [choice, setChoice] = useState<GameSixOption | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [retried, setRetried] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const reactionRef = useRef<HTMLAudioElement>(null);

  function submit() {
    if (feedback || !choice) return;
    stopActiveGameAudio();
    const correct = choice === "C";
    setFeedback(correct ? "correct" : "wrong");
    if (!retried) {
      setGreed((value) => Math.max(0, Math.min(meterMaximum, value + (correct ? 10 : -10))));
      if (!correct) {
        setDelusion((value) => Math.max(0, Math.min(meterMaximum, value - 10)));
      }
    }
    const audio = reactionRef.current;
    if (!audio) return;
    registerGameAudio(audio);
    audio.src = correct ? gameSixAudio.correct : gameSixAudio.wrong;
    audio.load();
    void audio.play().catch((error: unknown) => console.warn("Game 6 reaction audio could not play.", error));
  }

  function redo() {
    stopActiveGameAudio();
    setChoice(null);
    setFeedback(null);
    setRetried(true);
  }

  return (
    <main className="min-h-screen bg-slate-100 p-3 text-slate-800 sm:p-5">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-4 flex items-center justify-between gap-3">
          <button type="button" onClick={() => { stopActiveGameAudio(); setGame(5); }} className="inline-flex items-center gap-2 text-sm font-semibold text-[#193b61]"><ArrowLeft className="size-4" /> Previous: Game 5</button>
          <h1 className="text-center text-xl font-bold text-[#193b61]">Game 6: The Deployment Gamble</h1>
          <button type="button" onClick={() => setHelpOpen(true)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#193b61] hover:bg-slate-200"><HelpCircle className="size-4" /> Help</button>
        </header>
        <div className="mb-4 grid gap-3 sm:grid-cols-2"><Meter label="Boss&apos;s Greed Meter" value={greed} color="bg-red-500" /><Meter label="Client&apos;s Delusion Meter" value={delusion} color="bg-purple-500" /></div>
        <section className={`rounded-3xl border-2 p-4 shadow-lg sm:p-6 ${feedback === "wrong" ? "border-red-300 bg-red-50" : feedback === "correct" ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}>
          <div className="grid items-center gap-5 lg:grid-cols-[230px_minmax(0,1fr)_230px]">
            <Character src={feedback === "wrong" ? bossAngryImage : bossImage} alt="Boss character" label="Boss" />
            <div className="order-first rounded-2xl border-2 border-dashed border-[#9bb8c9] bg-white/80 p-5 text-center lg:order-none">
              {feedback ? <div className={`text-lg font-bold leading-7 ${feedback === "correct" ? "text-emerald-800" : "text-red-800"}`}>{feedback === "correct" ? <p>Boss: Good job</p> : <><p>Boss: The system is down for 4 hours! The clients are rioting! I am changing my LinkedIn status to &apos;Victim&apos;.</p><p className="mt-4">Client: My dog&apos;s picture is a 404 error! I&apos;m suing you!</p></>}</div> : <p className="text-sm leading-6 text-slate-700"><strong>Boss:</strong> We are deploying v2.0. We cannot have ANY downtime. If the new version fails, I need to be able to switch back to the old version INSTANTLY with zero downtime.</p>}
            </div>
            <Character src={feedback === "wrong" ? clientAngryImage : clientImage} alt="Client character" label="Client" />
          </div>
          <p className="my-6 text-center font-semibold text-[#193b61]">Choose the deployment strategy that guarantees instant rollback with zero downtime.</p>
          <div className="mx-auto grid max-w-3xl gap-3 md:grid-cols-2">{(Object.keys(gameSixOptions) as GameSixOption[]).map((option) => <button key={option} type="button" disabled={Boolean(feedback)} onClick={() => setChoice(option)} className={`rounded-xl border-2 p-4 text-left text-sm font-bold ${choice === option ? "border-[#193b61] bg-blue-100 text-[#193b61]" : "border-slate-200 bg-white text-slate-700"} disabled:cursor-not-allowed`}><strong>[{option}]</strong> {gameSixOptions[option]}</button>)}</div>
          <button type="button" onClick={submit} disabled={!choice || Boolean(feedback)} className="mt-5 w-full rounded-xl bg-[#193b61] px-5 py-3 font-bold text-white disabled:opacity-40">Submit answer</button>
          {feedback === "wrong" && <button type="button" onClick={redo} className="mt-4 w-full rounded-xl border border-[#193b61] bg-white px-5 py-3 font-bold text-[#193b61]">Redo</button>}
          {feedback === "correct" && <button type="button" onClick={() => { stopActiveGameAudio(); setPerformanceReview(true); }} className="mt-5 w-full rounded-xl bg-[#193b61] px-5 py-3 font-bold text-white">Performance review</button>}
        </section>
        <audio ref={reactionRef} preload="auto" />
      </div>
      {helpOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="game-six-help-title"><section className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-4 flex items-center justify-between gap-4"><h2 id="game-six-help-title" className="text-xl font-bold text-[#193b61]">Deployment strategies</h2><button type="button" onClick={() => setHelpOpen(false)} aria-label="Close help"><X className="size-5" /></button></div><div className="space-y-4 text-sm leading-6 text-slate-700"><p><strong>Big Bang:</strong> releases the new version all at once and normally requires service downtime, making rollback risky for business-critical systems. <strong>[p. 52]</strong></p><p><strong>Rolling Upgrade:</strong> gradually replaces the old version, so old and new instances coexist during the rollout. <strong>[p. 53]</strong></p><p><strong>Blue-Green Deployment:</strong> keeps two matching production environments. Traffic stays on the current environment while the new version is tested, then traffic can be switched between environments if a rollback is needed. <strong>[p. 54]</strong></p><p><strong>Canary:</strong> sends only a small portion of users or instances to the new version first, reducing rollout risk before expanding it. <strong>[p. 55]</strong></p></div></section></div>}
    </main>
  );
}

type PerformanceReviewProps = {
  greed: number;
  delusion: number;
  onFinish: () => void;
};

function PerformanceReview({ greed, delusion, onFinish }: PerformanceReviewProps) {
  const bossHigh = greed >= meterHighThreshold;
  const clientHigh = delusion >= meterHighThreshold;
  const ending = bossHigh && clientHigh
    ? {
      audio: endingAudio.bothHigh,
      boss: "You got a massive salary raise! Also, I'm taking 100% of the credit in the board meeting. You're welcome.",
      client: "Look forward to collaborating next time! My dog says you're his favorite human.",
    }
    : bossHigh
      ? {
        audio: endingAudio.bossHighClientLow,
        boss: "You saved us so much money! You get a raise! (Raises you by $2).",
        client: "I don't want to buy your service anymore. The app keeps telling me my dog wants wagyu beef. I'm suing you!",
      }
      : clientHigh
        ? {
          audio: endingAudio.bossLowClientHigh,
          boss: "You made the client happy, but we are bankrupt. You're fired! Take your cardboard box and get out!",
          client: "I love the product! Wait... why is the website just a picture of a sad intern? Where did your company go?",
        }
        : {
          audio: endingAudio.bothLow,
          boss: "You get fired. Actually, I'm firing the whole company.",
          client: "I don't want to buy your service anymore. In fact, I'm buying your company just to shut it down and erase your code from history.",
        };

  useEffect(() => {
    const audio = new Audio(ending.audio);
    registerGameAudio(audio);
    void audio.play().catch((error: unknown) => console.warn("Performance review audio could not start automatically.", error));
    return () => {
      if (activeGameAudio === audio) stopActiveGameAudio();
    };
  }, [ending.audio]);

  return (
    <main className="min-h-screen bg-slate-100 p-3 text-slate-800 sm:p-5">
      <div className="mx-auto max-w-[1100px]">
        <header className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-[#193b61]">Performance Review</h1>
          <p className="mt-2 text-sm text-slate-600">Your final result is based on your cumulative choices across all six games.</p>
        </header>
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <Meter label="Boss&apos;s Greed Meter" value={greed} color="bg-red-500" />
          <Meter label="Client&apos;s Delusion Meter" value={delusion} color="bg-purple-500" />
        </div>
        <section className="rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-lg sm:p-8">
          <div className="grid items-start gap-8 md:grid-cols-2">
            <div className="flex flex-col items-center gap-4">
              <Character src={bossHigh ? bossImage : bossAngryImage} alt="Final boss character" label="Boss" />
              <p className="w-full rounded-2xl bg-slate-50 p-4 text-center text-sm font-semibold leading-6 text-slate-700"><strong>Boss:</strong> {ending.boss}</p>
            </div>
            <div className="flex flex-col items-center gap-4">
              <Character src={clientHigh ? clientImage : clientAngryImage} alt="Final client character" label="Client" />
              <p className="w-full rounded-2xl bg-slate-50 p-4 text-center text-sm font-semibold leading-6 text-slate-700"><strong>Client:</strong> {ending.client}</p>
            </div>
          </div>
          <Link href="/student" onClick={onFinish} className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-[#193b61] px-5 py-3 font-bold text-white">Finish</Link>
        </section>
      </div>
    </main>
  );
}
