"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { LogoutButton } from "@/app/components/logout-button";
import {
  ArrowRight,
  BookOpen,
  Clock3,
  FileText,
  Moon,
  Settings,
  Send,
  Sparkles,
  Sun,
  Upload,
  X,
} from "lucide-react";

type StudentCourse = { id: string; category: string; title: string; description: string; updated: string };
type StudentAssignment = { id: string; title: string; course: string; labCount: number };

const cardStyle =
  "rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default function StudentPage({ courses, assignments, student }: { courses: StudentCourse[]; assignments: StudentAssignment[]; student: { id: string; email: string } }) {
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hi! What would you like to explore today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatError, setChatError] = useState("");

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsProfileOpen(false);
        setIsSettingsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || isLoading) {
      return;
    }

    const updatedMessages = [...messages, { role: "user" as const, content }];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);
    setChatError("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      });
      const result: unknown = await response.json();

      if (!response.ok) {
        const errorMessage =
          isRecord(result) && typeof result.error === "string"
            ? result.error
            : "The assistant could not respond. Please try again.";
        throw new Error(errorMessage);
      }

      if (!isRecord(result) || typeof result.message !== "string") {
        throw new Error("The assistant returned an invalid response.");
      }

      const reply = result.message;
      setMessages((currentMessages) => [
        ...currentMessages,
        { role: "assistant", content: reply },
      ]);
    } catch (error) {
      setChatError(
        error instanceof Error
          ? error.message
          : "Unable to reach the assistant. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  const panelStyle = isDark
    ? "rounded-2xl border border-slate-700 bg-slate-800 shadow-sm"
    : cardStyle;
  const primaryText = isDark ? "text-slate-100" : "text-[#193b61]";
  const secondaryText = isDark ? "text-slate-300" : "text-slate-500";

  return (
    <main
      className={`h-screen overflow-hidden p-3 text-slate-800 sm:p-4 ${
        isDark ? "bg-slate-950" : "bg-slate-50"
      }`}
      data-theme={isDark ? "dark" : "light"}
    >
      <div className="mx-auto flex h-full max-w-[1900px] gap-4">
        <section className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="flex h-12 shrink-0 items-center border-b border-slate-200">
            <h1 className="flex items-center gap-2 text-lg font-semibold leading-6 text-[#7791aa]">
              <BookOpen
                aria-hidden="true"
                className="size-6 shrink-0"
                strokeWidth={2.25}
              />
              <span>Learning Platform</span>
            </h1>
            <Link
              href="/mini-courses"
              className="ml-auto mr-2 inline-flex h-11 items-center gap-2 rounded-xl bg-[#193b61] px-4 text-sm font-semibold text-white shadow-[0_4px_12px_-6px_rgba(25,59,97,0.5)] transition-colors hover:bg-[#244d78]"
            >
              <BookOpen className="size-4" aria-hidden="true" />
              Mini-courses
            </Link>
          </header>

          <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1.45fr)_minmax(0,1fr)] gap-4">
            <section
              aria-labelledby="courses-heading"
              className="flex min-h-0 flex-col"
            >
              <div className="mb-3 flex shrink-0 items-center justify-between">
                <h2
                  className={`text-xl font-bold tracking-[-0.01em] ${primaryText}`}
                  id="courses-heading"
                >
                  My Courses
                </h2>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-3 gap-4 overflow-y-auto pr-1">
                {courses.map((course) => (
                  <article
                    className={`${panelStyle} group flex h-full max-h-[290px] min-h-0 flex-col p-4 transition-shadow duration-200 hover:shadow-md`}
                    key={course.title}
                  >
                    <div className="flex min-h-7 items-center">
                      <span
                        className="max-w-full truncate rounded-full px-2.5 py-1 text-[11px] font-medium leading-4 text-[#365575]"
                        style={{ backgroundColor: "#edf2f7" }}
                      >
                        {course.category}
                      </span>
                    </div>
                    <h3 className={`mt-3 line-clamp-2 text-lg font-bold leading-6 ${primaryText}`}>
                      {course.title}
                    </h3>
                    <p className={`mt-2 line-clamp-2 text-sm leading-5 ${secondaryText}`}>
                      {course.description}
                    </p>

                    <div className="mt-auto pt-4">
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span className={secondaryText}>Progress</span>
                        <span className={`font-semibold tabular-nums ${primaryText}`}>
                          0%
                        </span>
                      </div>
                      <div
                        aria-label="Practice progress is stored per Lab"
                        aria-valuemax={100}
                        aria-valuemin={0}
                        aria-valuenow={0}
                        className={`h-2 overflow-hidden rounded-full ${
                          isDark ? "bg-slate-700" : "bg-slate-100"
                        }`}
                        role="progressbar"
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: "0%",
                            backgroundColor: "#284b70",
                          }}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className={`flex min-w-0 items-center gap-1.5 truncate text-xs ${secondaryText}`}>
                          <Clock3 aria-hidden="true" className="size-3.5 shrink-0" />
                          {course.updated}
                        </span>
                        <Link
                          className={`inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61] ${
                            isDark
                              ? "border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700"
                              : "border-slate-200 bg-white text-[#24496f] hover:border-[#c8d9e8] hover:bg-[#e8eef4]"
                          }`}
                          href={`/student/courses/${course.id}`}
                        >
                          Continue
                          <ArrowRight
                            aria-hidden="true"
                            className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                          />
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section
              aria-labelledby="assignments-heading"
              className="flex min-h-0 flex-col"
            >
              <h2
                className={`mb-3 shrink-0 text-xl font-bold tracking-[-0.01em] ${primaryText}`}
                id="assignments-heading"
              >
                Interactive Labs
              </h2>
              <div className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),360px))] justify-start gap-2 overflow-y-auto pr-1">
                {assignments.map((assignment) => (
                  <article
                    className={`${panelStyle} flex h-full max-h-[180px] min-h-0 flex-col items-stretch justify-between gap-3 p-3`}
                    key={assignment.id}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className={`grid size-9 shrink-0 place-items-center rounded-lg ${
                          isDark
                            ? "bg-slate-700 text-slate-200"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        <FileText aria-hidden="true" className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <h3 className={`line-clamp-2 text-sm font-semibold leading-5 ${primaryText}`}>
                          {assignment.title}
                        </h3>
                        <p className={`mt-1 line-clamp-2 text-xs leading-4 ${secondaryText}`}>
                          {assignment.course}
                        </p>
                      </div>
                    </div>
                    <div className="flex w-full items-center justify-between gap-2">
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                          "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {assignment.labCount} Lab{assignment.labCount === 1 ? "" : "s"}
                      </span>
                      <Link
                        className={`inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61] ${
                          isDark
                            ? "border-slate-600 text-slate-100 hover:bg-slate-700"
                            : "border-slate-200 text-[#24496f] hover:bg-slate-50"
                        }`}
                        href={`/student/assignments/${assignment.id}`}
                      >
                        Start
                        <ArrowRight aria-hidden="true" className="size-3.5" />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </section>

        <aside className="flex h-full w-[320px] shrink-0 flex-col sm:w-[360px]">
          <div className="relative z-20 flex h-12 shrink-0 items-center justify-end border-b border-slate-200" ref={profileMenuRef}>
            <button
              aria-expanded={isProfileOpen}
              aria-haspopup="menu"
              aria-label="Open account menu"
              className="grid size-10 place-items-center rounded-full bg-red-600 text-sm font-semibold lowercase text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
              onClick={() => setIsProfileOpen((open) => !open)}
              type="button"
            >
              {student.email.slice(0, 2)}
            </button>

            {isProfileOpen && (
              <div
                className={`absolute right-0 top-12 z-30 w-72 rounded-2xl border p-4 shadow-xl ${
                  isDark
                    ? "border-slate-700 bg-slate-800 text-slate-100"
                    : "border-slate-200 bg-white text-slate-800"
                }`}
                role="menu"
              >
                <div className="border-b border-slate-200 pb-3">
                  <p className={`text-sm font-semibold ${primaryText}`}>{student.id}</p>
                  <p className={`mt-1 text-xs ${secondaryText}`}>
                    {student.email}
                  </p>
                </div>
                <button
                  className={`mt-3 flex min-h-10 w-full items-center justify-between rounded-lg px-2 text-sm transition-colors ${
                    isDark ? "hover:bg-slate-700" : "hover:bg-slate-50"
                  }`}
                  onClick={() => setIsDark((dark) => !dark)}
                  role="menuitem"
                  type="button"
                >
                  <span className="flex items-center gap-2">
                    {isDark ? (
                      <Moon aria-hidden="true" className="size-4" />
                    ) : (
                      <Sun aria-hidden="true" className="size-4" />
                    )}
                    Appearance
                  </span>
                  <span className="text-xs text-slate-500">
                    {isDark ? "Dark" : "Light"}
                  </span>
                </button>
                <button
                  className={`mt-1 flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-sm transition-colors ${
                    isDark ? "hover:bg-slate-700" : "hover:bg-slate-50"
                  }`}
                  onClick={() => {
                    setIsProfileOpen(false);
                    setIsSettingsOpen(true);
                  }}
                  role="menuitem"
                  type="button"
                >
                  <Settings aria-hidden="true" className="size-4" />
                  Settings
                </button>
                <LogoutButton
                  className="mt-1 flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-sm text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                  role="menuitem"
                />
              </div>
            )}
          </div>

          <section
            aria-labelledby="assistant-heading"
            className={`${panelStyle} mt-14 flex h-[400px] min-h-0 flex-col overflow-hidden`}
          >
            <header className={`flex shrink-0 items-center gap-3 border-b px-4 py-3 ${
              isDark ? "border-slate-700" : "border-slate-100"
            }`}>
              <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                isDark ? "bg-slate-700 text-slate-100" : "bg-[#edf2f7] text-[#284b70]"
              }`}>
                <Sparkles aria-hidden="true" className="size-[18px]" />
              </span>
              <div className="min-w-0">
                <h2
                  className={`text-sm font-semibold ${primaryText}`}
                  id="assistant-heading"
                >
                  AI Study Assistant
                </h2>
                <p className={`mt-0.5 text-[11px] ${secondaryText}`}>
                  Your study companion
                </p>
              </div>
            </header>

            <div
              aria-label="AI Study Assistant conversation"
              className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
              role="log"
            >
              {messages.map((message, index) =>
                message.role === "user" ? (
                  <div className="flex justify-end" key={index}>
                    <p className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-[#193b61] px-3 py-2.5 text-xs leading-5 text-white">
                      {message.content}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-start gap-2" key={index}>
                    <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ${
                      isDark ? "bg-slate-700 text-slate-200" : "bg-[#edf2f7] text-[#365575]"
                    }`}>
                      <Sparkles aria-hidden="true" className="size-3.5" />
                    </span>
                    <p className={`max-w-[92%] whitespace-pre-wrap rounded-2xl rounded-tl-md px-3 py-2.5 text-xs leading-5 ${
                      isDark ? "bg-slate-700 text-slate-100" : "bg-slate-100 text-slate-700"
                    }`}>
                      {message.content
                        .split(/(\[\d+\])/g)
                        .map((part, partIndex) =>
                          /^\[\d+\]$/.test(part) ? (
                            <sup
                              className="mx-0.5 inline-flex size-5 items-center justify-center rounded-full bg-[#dceafa] align-middle text-[10px] font-semibold leading-none text-[#244f80]"
                              key={partIndex}
                            >
                              {part.slice(1, -1)}
                            </sup>
                          ) : (
                            <span key={partIndex}>{part}</span>
                          ),
                        )}
                    </p>
                  </div>
                ),
              )}

              {isLoading && (
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ${
                    isDark ? "bg-slate-700 text-slate-200" : "bg-[#edf2f7] text-[#365575]"
                  }`}>
                    <Sparkles aria-hidden="true" className="size-3.5" />
                  </span>
                  <p
                    aria-label="AI Study Assistant 正在输入..."
                    className={`inline-flex items-center gap-2 rounded-2xl rounded-tl-md px-3 py-2.5 text-xs ${
                      isDark ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-500"
                    }`}
                    role="status"
                  >
                    AI 正在思考...
                    <span className="flex gap-1" aria-hidden="true">
                      <span className="size-1 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                      <span className="size-1 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                      <span className="size-1 animate-bounce rounded-full bg-slate-400" />
                    </span>
                  </p>
                </div>
              )}
            </div>

            <form
              className={`shrink-0 border-t p-3 ${
                isDark ? "border-slate-700" : "border-slate-100"
              }`}
              onSubmit={handleSendMessage}
            >
              <div className="mb-2">
                <button
                  className={`inline-flex min-h-7 items-center gap-1 rounded-full border px-2.5 text-[10px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61] ${
                    isDark
                      ? "border-slate-600 text-slate-200 hover:bg-slate-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                  type="button"
                >
                  <Upload aria-hidden="true" className="size-3" />
                  Create a Mini-Course
                </button>
              </div>
              <label className="sr-only" htmlFor="assistant-message">
                What do you want to learn today?
              </label>
              <div className={`flex items-center gap-2 rounded-xl border p-1 pl-3 transition-colors focus-within:border-[#8ca1b5] ${
                isDark ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-slate-50"
              }`}>
                <input
                  className={`min-w-0 flex-1 bg-transparent py-1.5 text-xs outline-none placeholder:text-slate-400 ${
                    isDark ? "text-slate-100" : "text-[#193b61]"
                  }`}
                  id="assistant-message"
                  name="assistant-message"
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="What do you want to learn today?"
                  value={input}
                  type="text"
                />
                <button
                  aria-label="Send message"
                  className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#193b61] text-white transition-colors hover:bg-[#284f77] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isLoading || !input.trim()}
                  type="submit"
                >
                  <Send aria-hidden="true" className="size-4" />
                </button>
              </div>
              {chatError && (
                <p
                  aria-live="polite"
                  className="mt-2 px-1 text-xs text-red-700"
                  role="alert"
                >
                  {chatError}
                </p>
              )}
            </form>
          </section>
        </aside>
      </div>

      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4"
          onClick={() => setIsSettingsOpen(false)}
        >
          <section
            aria-labelledby="settings-title"
            aria-modal="true"
            className={`w-full max-w-sm rounded-2xl border p-5 shadow-xl ${
              isDark
                ? "border-slate-700 bg-slate-800 text-slate-100"
                : "border-slate-200 bg-white text-slate-800"
            }`}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="flex items-center justify-between">
              <h2 className={`font-semibold ${primaryText}`} id="settings-title">
                Settings
              </h2>
              <button
                aria-label="Close settings"
                className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61]"
                onClick={() => setIsSettingsOpen(false)}
                type="button"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
            <p className={`mt-1 text-sm ${secondaryText}`}>
              Set your workspace appearance.
            </p>
            <button
              className={`mt-5 flex min-h-11 w-full items-center justify-between rounded-xl border px-3 text-sm ${
                isDark
                  ? "border-slate-600 hover:bg-slate-700"
                  : "border-slate-200 hover:bg-slate-50"
              }`}
              onClick={() => setIsDark((dark) => !dark)}
              type="button"
            >
              <span className="flex items-center gap-2">
                {isDark ? (
                  <Moon aria-hidden="true" className="size-4" />
                ) : (
                  <Sun aria-hidden="true" className="size-4" />
                )}
                Appearance
              </span>
              <span className="text-xs text-slate-500">
                {isDark ? "Dark" : "Light"}
              </span>
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
