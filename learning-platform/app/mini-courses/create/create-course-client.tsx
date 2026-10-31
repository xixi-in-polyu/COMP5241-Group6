"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Sparkles, Wand2 } from "lucide-react";

import { MaterialsEditor } from "@/app/components/mini-course/materials-editor";
import { CourseMaterialsEditor } from "@/app/components/course-materials-editor";
import { Badge, Card } from "@/app/components/mini-course/ui";
import { BACKGROUNDS, BLOCK_TYPE_LABELS, LEVELS } from "@/lib/mini-courses/labels";
import type {
  LearnerBackground,
  MiniCourseBlock,
  MiniCourseLevel,
  MiniCourseResource,
} from "@/lib/mini-courses/types";
import type { CourseMaterial, UnifiedCourse } from "@/lib/courses/types";

type Suggestion = {
  title: string;
  subject: string;
  summary: string;
  audience: string;
  level: MiniCourseLevel;
  background: LearnerBackground;
  durationMinutes: number;
  objectives: string[];
  chapterTopics: string[];
  evidence: string[];
};

type OutlineChapter = { title: string; blocks: MiniCourseBlock[] };

function blocksFromSections(
  chapterTitle: string,
  sections: { heading: string; body: string }[],
  summary: string,
): MiniCourseBlock[] {
  return [
    { id: crypto.randomUUID(), type: "heading", text: chapterTitle },
    ...sections.flatMap((section) => [
      { id: crypto.randomUUID(), type: "heading" as const, text: section.heading },
      { id: crypto.randomUUID(), type: "text" as const, text: section.body },
    ]),
    ...(summary
      ? [{ id: crypto.randomUUID(), type: "summary" as const, text: summary }]
      : []),
  ];
}

function blankOutline(title: string): OutlineChapter {
  return {
    title,
    blocks: [
      { id: crypto.randomUUID(), type: "heading", text: title },
      { id: crypto.randomUUID(), type: "text", text: "" },
    ],
  };
}

export function CreateCourseClient({ initialDraftId = null }: { initialDraftId?: string | null }) {
  const router = useRouter();
  const [draftId, setDraftId] = useState<string | null>(initialDraftId);
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Materials come first: they are what the AI reads to fill the form below.
  const [notes, setNotes] = useState("");
  const [resources, setResources] = useState<MiniCourseResource[]>([]);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [summary, setSummary] = useState("");
  const [audience, setAudience] = useState("");
  const [level, setLevel] = useState<MiniCourseLevel>("beginner");
  const [background, setBackground] = useState<LearnerBackground>("beginner");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [language, setLanguage] = useState<"en" | "zh">("en");
  const [objectives, setObjectives] = useState<string[]>([]);
  const [objectiveDraft, setObjectiveDraft] = useState("");

  const [chapterCount, setChapterCount] = useState(4);
  const [topics, setTopics] = useState<string[]>(["", "", "", ""]);
  const [includeReview, setIncludeReview] = useState(true);

  const [outline, setOutline] = useState<OutlineChapter[] | null>(null);

  const [busy, setBusy] = useState<"" | "draft" | "outline" | "create">("");
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");

  const resetWizard = useCallback(() => {
    setDraftId(null);
    setMaterials([]);
    setStep(1);
    setNotes("");
    setResources([]);
    setSuggestion(null);
    setTitle("");
    setSubject("");
    setSummary("");
    setAudience("");
    setLevel("beginner");
    setBackground("beginner");
    setDurationMinutes(30);
    setLanguage("en");
    setObjectives([]);
    setObjectiveDraft("");
    setChapterCount(4);
    setTopics(["", "", "", ""]);
    setIncludeReview(true);
    setOutline(null);
    setBusy("");
    setError("");
    setFieldError("");
  }, []);

  const hasShownRef = useRef(false);

  useEffect(() => {
    if (!hasShownRef.current) {
      hasShownRef.current = true;
      return;
    }
    // Next keeps this route mounted, so resetting when the page is shown again
    // makes each visit start a new course instead of reusing the last input.
    if (!initialDraftId) queueMicrotask(() => resetWizard());
  }, [initialDraftId, resetWizard]);

  useEffect(() => {
    if (!initialDraftId) return;
    let active = true;
    void fetch(`/api/courses/${initialDraftId}`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load the course draft.");
        if (!active) return;
        const course = data.course as UnifiedCourse & { pastedNotes?: string };
        setMaterials(course.materials);
        setNotes(course.pastedNotes ?? "");
        setTitle(course.title);
        setSubject(course.subject);
        setSummary(course.description);
        setAudience(course.audience);
        setLevel(course.level);
        setBackground(course.background);
        setDurationMinutes(course.durationMinutes);
        setLanguage(course.language);
        setObjectives(course.objectives);
        setResources(course.resources as MiniCourseResource[]);
        setTopics(course.chapters.map((chapter) => chapter.title));
        setChapterCount(Math.max(1, course.chapters.length || 4));
        setIncludeReview(false);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load the course draft.");
      });
    return () => { active = false; };
  }, [initialDraftId]);

  const plannedTopics = [
    ...Array.from({ length: chapterCount }, (_, index) => {
      const topic = (topics[index] ?? "").trim();
      return topic || (language === "zh" ? `第 ${index + 1} 章` : `Chapter ${index + 1}`);
    }),
    ...(includeReview ? [language === "zh" ? "复习与延伸" : "Review & extension"] : []),
  ];

  function payload(chapters = outline) {
    return {
      title: title.trim() || "Untitled course",
      description: summary,
      subject,
      audience,
      objectives,
      level,
      background,
      durationMinutes,
      language,
      resources: resources.filter((resource) => resource.url.trim()),
      chapters: (chapters ?? []).map((chapter) => ({
        title: chapter.title,
        objectives: [],
        resources: [],
        blocks: chapter.blocks,
      })),
      pastedNotes: notes,
    };
  }

  async function readCourse(id: string) {
    const response = await fetch(`/api/courses/${id}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not refresh the course.");
    setMaterials((data.course as UnifiedCourse).materials);
  }

  async function ensureDraft(sync = false) {
    if (draftId) {
      if (sync) {
        const response = await fetch(`/api/courses/${draftId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload()),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not save the draft.");
        setMaterials((data.course as UnifiedCourse).materials);
      }
      return draftId;
    }
    const response = await fetch("/api/courses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload()),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not create the course draft.");
    const course = data.course as UnifiedCourse;
    setDraftId(course.id);
    setMaterials(course.materials);
    return course.id;
  }

  useEffect(() => {
    if (!draftId || !materials.some((item) => item.status === "uploaded" || item.status === "parsing")) return;
    const timer = setInterval(() => void readCourse(draftId).catch(() => undefined), 2_000);
    return () => clearInterval(timer);
  }, [draftId, materials]);

  function addObjective() {
    const value = objectiveDraft.trim();
    if (!value) return;
    setObjectives([...objectives, value]);
    setObjectiveDraft("");
  }

  function updateChapterCount(next: number) {
    const safe = Math.max(1, Math.min(12, Number.isFinite(next) ? next : 1));
    setChapterCount(safe);
    setTopics((current) => Array.from({ length: safe }, (_, index) => current[index] ?? ""));
  }

  async function draftWithAi() {
    setBusy("draft");
    setError("");
    try {
      const courseId = await ensureDraft(true);
      const response = await fetch("/api/ai/course-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId, language, title }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "The AI service is not available right now.");
      }
      setSuggestion(data.suggestion as Suggestion);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not reach the AI service.");
    } finally {
      setBusy("");
    }
  }

  function applySuggestion() {
    if (!suggestion) return;
    setTitle(suggestion.title);
    setSubject(suggestion.subject);
    setSummary(suggestion.summary);
    setAudience(suggestion.audience);
    setLevel(suggestion.level);
    setBackground(suggestion.background);
    setDurationMinutes(suggestion.durationMinutes);
    setObjectives(suggestion.objectives);
    setTopics(suggestion.chapterTopics);
    setChapterCount(Math.max(1, Math.min(12, suggestion.chapterTopics.length)));
    setSuggestion(null);
  }

  function goToDesign() {
    if (!title.trim() || !subject.trim()) {
      setFieldError("Title and subject are required.");
      return;
    }
    setFieldError("");
    setStep(2);
  }

  function writeMyself() {
    if (plannedTopics.length === 0) {
      setError("Add at least one chapter topic.");
      return;
    }
    setError("");
    setOutline(plannedTopics.map(blankOutline));
    setStep(3);
  }

  async function generateOutline() {
    if (plannedTopics.length === 0) {
      setError("Add at least one chapter topic.");
      return;
    }
    setBusy("outline");
    setError("");
    try {
      const courseId = await ensureDraft(true);
      const response = await fetch("/api/ai/course-chapters", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          courseId,
          language,
          title,
          subject,
          audience,
          level,
          objectives,
          chapterTopics: plannedTopics,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "The AI service is not available right now.");
      }
      const chapters = data.chapters as {
        title: string;
        sections: { heading: string; body: string }[];
        summary: string;
      }[];
      setOutline(
        plannedTopics.map((topic, index) => {
          const chapter = chapters[index];
          return chapter
            ? { title: topic, blocks: blocksFromSections(topic, chapter.sections, chapter.summary) }
            : blankOutline(topic);
        }),
      );
      setStep(3);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not generate the outline.");
    } finally {
      setBusy("");
    }
  }

  async function create() {
    if (!outline) return;
    setBusy("create");
    setError("");
    try {
      const id = await ensureDraft();
      const response = await fetch(`/api/courses/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload(outline)),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Could not create the mini-course.");
      }
      // Next keeps this route mounted for back/forward navigation, so clear the
      // wizard before leaving. Otherwise the next "Create course" restores this
      // course's data and the buttons stay disabled by the stale busy state.
      if (!initialDraftId) resetWizard();
      router.push(`/courses/${data.course.id}/edit`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the mini-course.");
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#54738f]">
            {initialDraftId ? "Regenerate course" : "New course"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-[#142f4d]">
            {step === 1 ? "Materials and basics" : step === 2 ? "Learning design" : "Outline"}
          </h1>
        </div>
        <ol className="flex items-center gap-2 text-xs font-semibold">
          {[1, 2, 3].map((index) => (
            <li
              key={index}
              className={
                index === step
                  ? "rounded-full bg-[#193b61] px-2.5 py-1 text-white"
                  : "rounded-full bg-[#eef2f6] px-2.5 py-1 text-[#6a7c90]"
              }
            >
              {index}. {index === 1 ? "Basics" : index === 2 ? "Design" : "Outline"}
            </li>
          ))}
        </ol>
      </header>

      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-[#fdf3f3] px-3 py-2 text-xs text-[#a3232b]">
          {error}
        </p>
      ) : null}

      {step === 1 ? (
        <>
          <Card className="mt-5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[#142f4d]">Course materials</h2>
                <p className="mt-1 text-xs leading-5 text-[#6a7c90]">
                  Optional. Paste notes or upload files for AI grounding. Links are published as
                  learning resources only and are never fetched or sent to AI.
                </p>
              </div>
              <button
                type="button"
                onClick={draftWithAi}
                disabled={busy !== ""}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#c6d2df] bg-white px-3 text-sm font-semibold text-[#193b61] hover:bg-[#f7f9fb] disabled:opacity-50"
              >
                {busy === "draft" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="size-4" aria-hidden="true" />
                )}
                {busy === "draft" ? "Reading your materials…" : "Auto-fill with AI (optional)"}
              </button>
            </div>
            <textarea
              className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6"
              rows={5}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Paste lecture notes, a transcript, or a source summary…"
            />
            <div className="mt-3">
              <MaterialsEditor resources={resources} onChange={setResources} showHeading={false} />
            </div>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <CourseMaterialsEditor courseId={draftId} materials={materials} selectionMaterials={materials} showAiSelection ensureCourse={() => ensureDraft(true)} onRefresh={readCourse} />
            </div>

            {suggestion ? (
              <div className="mt-4 rounded-xl border border-[#cfe0f2] bg-[#f7fafd] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="info">
                    <Sparkles className="size-3" aria-hidden="true" />
                    Draft from your materials
                  </Badge>
                  <span className="text-xs text-[#6a7c90]">nothing is applied yet</span>
                </div>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[#6a7c90]">Title</dt>
                    <dd>{suggestion.title}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[#6a7c90]">Subject</dt>
                    <dd>{suggestion.subject}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[#6a7c90]">Level</dt>
                    <dd>{suggestion.level}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[#6a7c90]">Suits</dt>
                    <dd>{suggestion.background}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[#6a7c90]">Duration</dt>
                    <dd>{suggestion.durationMinutes} min</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[#6a7c90]">Learners</dt>
                    <dd>{suggestion.audience}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-sm leading-6 text-[#53657a]">{suggestion.summary}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[#6a7c90]">
                  Objectives
                </p>
                <ul className="mt-1 space-y-1 text-sm text-[#53657a]">
                  {suggestion.objectives.map((objective) => (
                    <li key={objective}>– {objective}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[#6a7c90]">
                  Chapters
                </p>
                <ol className="mt-1 space-y-1 text-sm text-[#53657a]">
                  {suggestion.chapterTopics.map((topic, index) => (
                    <li key={topic}>
                      {index + 1}. {topic}
                    </li>
                  ))}
                </ol>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={applySuggestion}
                    className="rounded-lg bg-[#193b61] px-3 py-2 text-xs font-semibold text-white"
                  >
                    Use this draft
                  </button>
                  <button
                    type="button"
                    onClick={() => setSuggestion(null)}
                    className="rounded-lg border border-[#c6d2df] px-3 py-2 text-xs font-semibold text-[#193b61]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </Card>

          <Card className="mt-4 p-5">
            <h2 className="text-sm font-semibold text-[#142f4d]">Course details</h2>
            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-[#193b61]">Title *</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Debugging JavaScript like a professional"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-[#193b61]">Subject *</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="e.g. Web development"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-[#193b61]">Target learners</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={audience}
                    onChange={(event) => setAudience(event.target.value)}
                    placeholder="e.g. Students who finished unit 1"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-[#193b61]">Summary</span>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6"
                  rows={3}
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  placeholder="What will learners walk away with?"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-4">
                <label className="block">
                  <span className="text-xs font-semibold text-[#193b61]">Difficulty</span>
                  <select
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm"
                    value={level}
                    onChange={(event) => setLevel(event.target.value as MiniCourseLevel)}
                  >
                    {LEVELS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-[#193b61]">Suits</span>
                  <select
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm"
                    value={background}
                    onChange={(event) => setBackground(event.target.value as LearnerBackground)}
                  >
                    {BACKGROUNDS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.short}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-[#193b61]">Minutes</span>
                  <input
                    type="number"
                    min={5}
                    max={600}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm"
                    value={durationMinutes}
                    onChange={(event) => setDurationMinutes(Number(event.target.value))}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-[#193b61]">Language</span>
                  <select
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm"
                    value={language}
                    onChange={(event) => setLanguage(event.target.value === "zh" ? "zh" : "en")}
                  >
                    <option value="en">English</option>
                    <option value="zh">中文</option>
                  </select>
                </label>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#193b61]">Objectives</p>
                <ul className="mt-1 space-y-1">
                  {objectives.map((objective, index) => (
                    <li key={`${objective}-${index}`} className="flex items-center gap-2 text-sm">
                      <span className="flex-1">– {objective}</span>
                      <button
                        type="button"
                        onClick={() => setObjectives(objectives.filter((_, i) => i !== index))}
                        className="text-xs text-[#8a99a9] hover:text-[#8c1d24]"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-1 flex gap-2">
                  <input
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={objectiveDraft}
                    onChange={(event) => setObjectiveDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addObjective();
                      }
                    }}
                    placeholder="Add an objective and press Enter"
                  />
                  <button
                    type="button"
                    onClick={addObjective}
                    className="rounded-lg border border-[#c6d2df] px-3 text-xs font-semibold text-[#193b61]"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {fieldError ? (
              <p role="alert" className="mt-3 text-xs font-medium text-[#a3232b]">
                {fieldError}
              </p>
            ) : null}

            <div className="mt-5 flex items-center justify-between">
              <Link href="/courses" className="text-sm font-semibold text-[#24496f] hover:underline">
                Cancel
              </Link>
              <button
                type="button"
                onClick={goToDesign}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#193b61] px-4 text-sm font-semibold text-white"
              >
                Continue
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          </Card>
        </>
      ) : null}

      {step === 2 ? (
        <Card className="mt-5 p-5">
          <h2 className="text-sm font-semibold text-[#142f4d]">Structure</h2>
          <p className="mt-1 text-xs leading-5 text-[#6a7c90]">
            Choose how many chapters the course should have, then describe each one. Leave a topic
            empty and it will be named for you.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-[#193b61]">Chapters</span>
              <input
                type="number"
                min={1}
                max={12}
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm"
                value={chapterCount}
                onChange={(event) => updateChapterCount(Number(event.target.value))}
              />
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm text-[#263e58]">
              <input
                type="checkbox"
                className="size-4"
                checked={includeReview}
                onChange={(event) => setIncludeReview(event.target.checked)}
              />
              Add a final review chapter
            </label>
          </div>

          <p className="mt-4 text-xs font-semibold text-[#193b61]">Chapter topics</p>
          <ol className="mt-2 space-y-1.5">
            {Array.from({ length: chapterCount }, (_, index) => (
              <li key={index} className="flex items-center gap-2">
                <span className="w-10 shrink-0 text-xs text-[#8a99a9]">Ch. {index + 1}</span>
                <input
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                  value={topics[index] ?? ""}
                  onChange={(event) =>
                    setTopics((current) =>
                      current.map((item, i) => (i === index ? event.target.value : item)),
                    )
                  }
                  placeholder={`Topic for chapter ${index + 1}`}
                  aria-label={`Topic for chapter ${index + 1}`}
                />
              </li>
            ))}
          </ol>
          {includeReview ? (
            <p className="mt-2 text-xs text-[#6a7c90]">A review chapter is appended automatically.</p>
          ) : null}
          <label className="mt-3 flex items-center gap-2 text-xs text-[#53657a]">
            <input
              type="checkbox"
              checked={includeReview}
              onChange={(event) => setIncludeReview(event.target.checked)}
            />
            Append a review chapter at the end
          </label>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#c6d2df] bg-white px-3 text-sm font-semibold text-[#193b61]"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </button>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={writeMyself}
                disabled={busy === "outline"}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#193b61] px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                Create the outline myself
              </button>
              <button
                type="button"
                onClick={generateOutline}
                disabled={busy === "outline"}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#c6d2df] bg-white px-3 text-sm font-semibold text-[#193b61] disabled:opacity-50"
              >
                {busy === "outline" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Wand2 className="size-4" aria-hidden="true" />
                )}
                {busy === "outline" ? "Writing chapter bodies…" : "Write the bodies with AI"}
              </button>
            </div>
          </div>

          <p className="mt-3 text-xs leading-5 text-[#6a7c90]">
            Both options lead to the same next step. AI is optional: it reads your materials and
            drafts the chapter bodies, which you can then edit.
          </p>
        </Card>
      ) : null}

      {step === 3 && outline ? (
        <Card className="mt-5 p-5">
          <h2 className="text-sm font-semibold text-[#142f4d]">
            {outline.some((chapter) => chapter.blocks.length > 2)
              ? "AI-written chapters"
              : "Your outline"}
          </h2>
          <p className="mt-1 text-xs leading-5 text-[#6a7c90]">
            Body text can be edited in the editor. Nothing is saved until you create the course.
          </p>

          <ol className="mt-3 space-y-3">
            {outline.map((chapter, index) => (
              <li
                key={`${chapter.title}-${index}`}
                className="rounded-xl border border-[#e2e8f0] bg-[#fbfcfe] p-4"
              >
                <div className="flex items-start gap-2">
                  <span className="mt-2 w-10 shrink-0 text-xs font-semibold text-[#8a99a9]">
                    Ch. {index + 1}
                  </span>
                  <input
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium"
                    value={chapter.title}
                    onChange={(event) =>
                      setOutline(
                        outline.map((item, i) =>
                          i === index ? { ...item, title: event.target.value } : item,
                        ),
                      )
                    }
                    aria-label={`Chapter ${index + 1} title`}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 pl-12">
                  {chapter.blocks.map((block) => (
                    <span
                      key={block.id}
                      className="rounded-full bg-[#eef2f6] px-2 py-0.5 text-[11px] font-medium text-[#5b6b7d]"
                    >
                      {BLOCK_TYPE_LABELS[block.type]}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#c6d2df] bg-white px-3 text-sm font-semibold text-[#193b61]"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </button>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={generateOutline}
                disabled={busy === "outline" || busy === "create"}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#c6d2df] bg-white px-3 text-sm font-semibold text-[#193b61] disabled:opacity-50"
              >
                <Wand2 className="size-4" aria-hidden="true" />
                Regenerate
              </button>
              <button
                type="button"
                onClick={create}
                disabled={busy === "outline" || busy === "create"}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#193b61] px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy === "create" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                Create mini-course
              </button>
            </div>
          </div>
        </Card>
      ) : null}
    </main>
  );
}
