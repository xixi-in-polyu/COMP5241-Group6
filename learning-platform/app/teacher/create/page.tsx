"use client";

import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  LoaderCircle,
  Sparkles,
  Upload,
} from "lucide-react";
import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useRef,
  useState,
} from "react";

export default function CreateCoursePage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const generationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (generationTimerRef.current) {
        clearTimeout(generationTimerRef.current);
      }
    },
    [],
  );

  function selectFile(file: File | undefined) {
    if (file) {
      setFileName(file.name);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.currentTarget.files?.[0]);
  }

  function handleFileDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files[0]);
  }

  function handleGenerate() {
    if (isGenerating) {
      return;
    }

    setIsGenerated(false);
    setIsGenerating(true);
    generationTimerRef.current = setTimeout(() => {
      setIsGenerating(false);
      setIsGenerated(true);
      generationTimerRef.current = null;
    }, 2000);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-7 text-slate-800 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <Link
          className="inline-flex min-h-11 items-center gap-2 rounded-lg pr-3 text-sm font-medium text-[#24496f] transition-colors duration-200 hover:text-[#193b61] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61]"
          href="/teacher"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to Dashboard
        </Link>

        <section
          aria-labelledby="create-course-heading"
          className="mx-auto mt-5 max-w-[800px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <header className="border-b border-slate-100 px-5 py-6 sm:px-8 sm:py-7">
            <h1
              className="font-serif text-2xl tracking-[-0.03em] text-[#142f4d] sm:text-3xl"
              id="create-course-heading"
            >
              Create a course
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Set up your course, then use AI to prepare teaching materials.
            </p>
          </header>

          <form className="space-y-7 px-5 py-6 sm:px-8 sm:py-8">
            <div>
              <label
                className="mb-2 block text-sm font-semibold text-[#193b61]"
                htmlFor="course-title"
              >
                Course Title
              </label>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-[#193b61] outline-none transition placeholder:text-slate-400 focus:border-[#7791aa] focus:ring-4 focus:ring-[#e8eef4]"
                id="course-title"
                name="title"
                placeholder="e.g. Introduction to Human-Computer Interaction"
                type="text"
              />
            </div>

            <div>
              <label
                className="mb-2 block text-sm font-semibold text-[#193b61]"
                htmlFor="course-description"
              >
                Course Description
              </label>
              <textarea
                className="min-h-32 w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm leading-6 text-[#193b61] outline-none transition placeholder:text-slate-400 focus:border-[#7791aa] focus:ring-4 focus:ring-[#e8eef4]"
                id="course-description"
                name="description"
                placeholder="Describe what students will learn in this course."
                rows={4}
              />
            </div>

            <section
              aria-labelledby="ai-assistant-heading"
              className="rounded-2xl border border-[#d8e5f3] bg-[#f2f7fc] p-4 sm:p-6"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#385f88] shadow-sm">
                  <Sparkles aria-hidden="true" className="size-[19px]" />
                </span>
                <div>
                  <h2
                    className="text-base font-semibold text-[#193b61]"
                    id="ai-assistant-heading"
                  >
                    AI Course Assistant
                  </h2>
                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    Add source material and describe the slides you need.
                  </p>
                </div>
              </div>

              <input
                accept=".pdf,video/*"
                className="sr-only"
                id="course-source"
                onChange={handleFileChange}
                type="file"
              />
              <label
                className={`mt-5 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-5 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#193b61] ${
                  isDragging
                    ? "border-[#547ca3] bg-[#e8f1fa]"
                    : "border-[#b9cadb] bg-white/70 hover:border-[#7791aa] hover:bg-white"
                }`}
                htmlFor="course-source"
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleFileDrop}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    document.getElementById("course-source")?.click();
                  }
                }}
              >
                <span className="mb-2 grid size-9 place-items-center rounded-lg bg-[#e9f0f7] text-[#385f88]">
                  {fileName ? (
                    <FileText aria-hidden="true" className="size-[18px]" />
                  ) : (
                    <Upload aria-hidden="true" className="size-[18px]" />
                  )}
                </span>
                <span className="text-sm font-semibold text-[#24496f]">
                  {fileName || "Upload PDF/Video"}
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  {fileName
                    ? "Choose another file or drop it here"
                    : "Drag and drop a file here, or click to browse"}
                </span>
              </label>

              <label className="sr-only" htmlFor="ai-instructions">
                AI slide and narration instructions
              </label>
              <textarea
                className="mt-4 min-h-24 w-full resize-y rounded-xl border border-[#d8e1eb] bg-white px-3.5 py-3 text-sm leading-6 text-[#193b61] outline-none transition placeholder:text-slate-400 focus:border-[#7791aa] focus:ring-4 focus:ring-[#e8eef4]"
                id="ai-instructions"
                name="ai-instructions"
                placeholder="What kind of slides or audio narration do you want AI to generate?"
                rows={3}
              />

              <button
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#344d78] px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#283e65] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61] disabled:cursor-wait disabled:opacity-80 sm:w-auto"
                disabled={isGenerating}
                onClick={handleGenerate}
                type="button"
              >
                {isGenerating ? (
                  <>
                    <LoaderCircle
                      aria-hidden="true"
                      className="size-4 animate-spin motion-reduce:animate-none"
                    />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles aria-hidden="true" className="size-4" />
                    Generate Slides with AI
                  </>
                )}
              </button>

              {isGenerated && (
                <p
                  aria-live="polite"
                  className="mt-3 text-sm font-medium text-emerald-700"
                  role="status"
                >
                  Slides and narration generated successfully!
                </p>
              )}
            </section>

            <footer className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#24496f] transition-colors duration-200 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61]"
                type="button"
              >
                Save as Draft
              </button>
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#193b61] px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#284f77] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61]"
                type="button"
              >
                Publish Course
              </button>
            </footer>
          </form>
        </section>
      </div>
    </main>
  );
}
