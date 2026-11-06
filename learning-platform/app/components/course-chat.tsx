"use client";

import { ArrowUp, ChevronLeft, MessageSquare, User } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { extractPdfPages, type PdfPage } from "@/lib/pdf/extract-text";

type ChatMessage = { role: "user" | "assistant"; content: string };
type Conversation = { id: string; title: string; messages: ChatMessage[]; updatedAt: number };

const MAX_CONVERSATIONS = 20;
const PAGE_MARKER = /\[(?:p|page)\s*\.?\s*(\d+)\]/gi;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isConversation(value: unknown): value is Conversation {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.updatedAt === "number" &&
    Array.isArray(value.messages) &&
    value.messages.every(
      (message) =>
        isRecord(message) &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string",
    )
  );
}

// Turn "[p4]" / "[Page 4]" markers into links so the markdown renderer can draw
// them as page badges that jump the PDF viewer. Models sometimes forget the
// marker format and write "page 4" instead, so those mentions are converted too.
function withPageLinks(content: string) {
  return content
    .replace(PAGE_MARKER, (_match, page: string) => `[p${page}](#page-${page})`)
    .replace(/\bpage\s*(\d+)(?:\s*\/\s*\d+)?\b/gi, (_match, page: string) => `[p${page}](#page-${page})`);
}

function createMarkdownComponents(onPageChange?: (page: number) => void): Components {
  return {
    p: ({ children }) => <p className="text-sm leading-6 text-slate-700">{children}</p>,
    strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    h1: ({ children }) => <h2 className="text-sm font-semibold text-slate-900">{children}</h2>,
    h2: ({ children }) => <h2 className="text-sm font-semibold text-slate-900">{children}</h2>,
    h3: ({ children }) => <h3 className="text-sm font-semibold text-slate-900">{children}</h3>,
    ul: ({ children }) => (
      <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-700">{children}</ol>
    ),
    li: ({ children }) => <li className="pl-0.5">{children}</li>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-slate-200 pl-3 text-sm leading-6 text-slate-600">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="my-1 border-slate-200" />,
    pre: ({ children }) => (
      <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-5 text-slate-100 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-inherit">
        {children}
      </pre>
    ),
    code: ({ children }) => (
      <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px] text-slate-800">{children}</code>
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full border-collapse text-left text-xs">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-slate-50 text-slate-600">{children}</thead>,
    th: ({ children }) => (
      <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">{children}</th>
    ),
    td: ({ children }) => (
      <td className="border-b border-slate-100 px-2 py-1.5 align-top text-slate-700">{children}</td>
    ),
    a: ({ href, children }) => {
      const page = href?.match(/^#page-(\d+)$/)?.[1];
      if (page) {
        if (!onPageChange) {
          return (
            <span className="mx-0.5 inline-flex rounded-full bg-[#e8f1fb] px-1.5 py-0.5 align-baseline text-[10px] font-semibold text-[#245a94]">
              p.{page}
            </span>
          );
        }
        return (
          <button
            className="mx-0.5 inline-flex items-center rounded-full bg-[#e8f1fb] px-1.5 py-0.5 align-baseline text-[10px] font-semibold text-[#245a94] transition-colors hover:bg-[#d3e5fa] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#245a94]"
            onClick={() => onPageChange(Number(page))}
            title={`Jump to page ${page}`}
            type="button"
          >
            p.{page}
          </button>
        );
      }
      return (
        <a
          className="text-[#245a94] underline underline-offset-2"
          href={href}
          rel="noreferrer"
          target="_blank"
        >
          {children}
        </a>
      );
    },
  };
}

export function CourseChat({
  courseId,
  fileId,
  fileName,
  currentFileUrl,
  onPageChange,
  userId,
}: {
  courseId: string;
  fileId: string;
  fileName: string;
  currentFileUrl: string | null;
  onPageChange?: (page: number) => void;
  userId: string;
}) {
  const storageKey = `course-chat:${userId}:${courseId}:${fileId}`;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [pdfStatus, setPdfStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [pdfError, setPdfError] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const pdfPagesRef = useRef<PdfPage[]>([]);
  const extractionRef = useRef<Promise<PdfPage[]> | null>(null);

  const active = conversations.find((conversation) => conversation.id === activeId) ?? null;
  const displayName = fileName.replace(/\.[^.]+$/, "");
  const lastMessage = active?.messages[active.messages.length - 1];
  const showThinking = isLoading && lastMessage?.role !== "assistant";
  const markdownComponents = createMarkdownComponents(onPageChange);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = window.localStorage.getItem(storageKey);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        if (Array.isArray(parsed)) {
          setConversations(parsed.filter(isConversation).slice(0, MAX_CONVERSATIONS));
        }
      } catch {
        // Ignore unreadable history.
      }
      setHydrated(true);
    });
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(conversations.slice(0, MAX_CONVERSATIONS)));
    } catch {
      // Storage may be unavailable or full; the chat still works for this session.
    }
  }, [conversations, hydrated, storageKey]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [active, isLoading]);

  useEffect(() => {
    if (!currentFileUrl) return;
    let active = true;

    extractionRef.current = extractPdfPages(currentFileUrl)
      .then((pages) => {
        pdfPagesRef.current = pages;
        if (active) setPdfStatus(pages.length ? "ready" : "empty");
        return pages;
      })
      .catch((reason: unknown) => {
        if (active) {
          setPdfStatus("error");
          setPdfError(reason instanceof Error ? reason.message : "Could not read the PDF.");
        }
        return [];
      });

    return () => {
      active = false;
    };
  }, [currentFileUrl]);

  async function send(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const content = input.trim();
    if (!content || isLoading) return;

    const conversationId = active?.id ?? crypto.randomUUID();
    const messages = [...(active?.messages ?? []), { role: "user" as const, content }];
    setConversations((current) => {
      const existing = current.find((conversation) => conversation.id === conversationId);
      const updated: Conversation = {
        id: conversationId,
        title: existing?.title ?? content.slice(0, 60),
        messages,
        updatedAt: Date.now(),
      };
      return [
        updated,
        ...current.filter((conversation) => conversation.id !== conversationId),
      ].slice(0, MAX_CONVERSATIONS);
    });
    setActiveId(conversationId);
    setInput("");
    setIsLoading(true);
    setError("");

    try {
      if (!pdfPagesRef.current.length && extractionRef.current) {
        await extractionRef.current;
      }
      const pages = pdfPagesRef.current;
      const context = pages.length
        ? `当前PDF文件内容如下（[Page N] 表示第 N 页）：\n\n${pages
            .map((page) => `[Page ${page.page}]\n${page.text}`)
            .join("\n\n")}`
        : undefined;

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, context }),
      });

      if (!response.ok) {
        const result: unknown = await response.json().catch(() => ({}));
        throw new Error(
          isRecord(result) && typeof result.error === "string"
            ? result.error
            : "The assistant could not respond. Please try again.",
        );
      }
      if (!response.body) {
        throw new Error("The assistant returned an empty response.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let reply = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          let chunk: unknown;
          try {
            chunk = JSON.parse(line);
          } catch {
            continue;
          }
          if (!isRecord(chunk)) continue;
          if (typeof chunk.error === "string") throw new Error(chunk.error);
          if (typeof chunk.delta !== "string" || !chunk.delta) continue;

          reply += chunk.delta;
          const snapshot = reply;
          setConversations((current) =>
            current.map((conversation) => {
              if (conversation.id !== conversationId) return conversation;
              const nextMessages = [...conversation.messages];
              const last = nextMessages[nextMessages.length - 1];
              if (last?.role === "assistant") {
                nextMessages[nextMessages.length - 1] = { role: "assistant", content: snapshot };
              } else {
                nextMessages.push({ role: "assistant", content: snapshot });
              }
              return { ...conversation, messages: nextMessages, updatedAt: Date.now() };
            }),
          );
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to reach the assistant. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  if (active) {
    return (
      <section aria-label="AI study chat" className="flex h-full min-h-0 flex-col">
        <header className="flex shrink-0 items-center border-b border-slate-200 px-2 py-1.5">
          <button
            aria-label="Back to recent conversations"
            className="grid size-9 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61]"
            onClick={() => setActiveId(null)}
            type="button"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <h2 className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-slate-800">{active.title}</h2>
          <span className="size-9" aria-hidden="true" />
        </header>

        {pdfStatus === "loading" ? (
          <p className="shrink-0 border-b border-slate-100 px-4 py-1.5 text-[11px] text-slate-500">
            Reading the PDF...
          </p>
        ) : null}
        {pdfStatus === "error" || pdfStatus === "empty" ? (
          <p
            className="shrink-0 border-b border-amber-100 bg-amber-50 px-4 py-2 text-[11px] leading-5 text-amber-800"
            title={pdfError || undefined}
          >
            {pdfStatus === "error"
              ? "Couldn't read this PDF's text. Chat still works, but answers may be less specific."
              : "This PDF has no extractable text. Answers may be less specific."}
          </p>
        ) : null}

        <div
          aria-label="Conversation"
          className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-5"
          ref={logRef}
          role="log"
        >
          {active.messages.map((message, index) => (
            <article className="flex gap-3" key={index}>
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-full text-white ${
                  message.role === "user" ? "bg-[#f59e0b]" : "bg-[#2f80ed]"
                }`}
              >
                {message.role === "user" ? (
                  <User className="size-4" aria-hidden="true" />
                ) : (
                  <MessageSquare className="size-4" aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {message.role === "user" ? "You" : "GPTutor"}
                </p>
                {message.role === "user" ? (
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{message.content}</p>
                ) : (
                  <div className="mt-1 space-y-2">
                    <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
                      {withPageLinks(message.content)}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </article>
          ))}

          {showThinking && (
            <p className="pl-11 text-sm text-slate-500" role="status">
              GPTutor is thinking...
            </p>
          )}
        </div>

        <form className="shrink-0 border-t border-slate-200 p-3" onSubmit={send}>
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-colors focus-within:border-[#8ca1b5]">
            <label className="sr-only" htmlFor="course-chat-input">
              Message GPTutor
            </label>
            <textarea
              className="w-full resize-none bg-transparent text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400"
              id="course-chat-input"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={2}
              value={input}
            />
            <div className="mt-1 flex items-center justify-end">
              <button
                aria-label="Send message"
                className="grid size-9 place-items-center rounded-full bg-[#193b61] text-white transition-colors hover:bg-[#284f77] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={isLoading || !input.trim()}
                type="submit"
              >
                <ArrowUp className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
          {error && (
            <p aria-live="polite" className="mt-2 text-xs text-red-700" role="alert">
              {error}
            </p>
          )}
          <p className="mt-2 text-center text-[11px] text-slate-400">
            GPTutor can make mistakes. Check important info.
          </p>
        </form>
      </section>
    );
  }

  return (
    <section aria-label="AI study chat" className="flex h-full min-h-0 flex-col overflow-y-auto px-5 py-6">
      <div className="flex flex-col items-center text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-[#e8f1fb] text-[#2f80ed]">
          <MessageSquare className="size-7" aria-hidden="true" />
        </span>
        <h2 className="mt-4 line-clamp-2 text-lg font-semibold text-slate-900">{displayName}</h2>
        {currentFileUrl ? (
          <a
            className="mt-1 text-xs font-semibold text-[#24496f] hover:underline"
            href={currentFileUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open file
          </a>
        ) : null}
        {pdfStatus === "loading" ? (
          <p className="mt-1 text-[11px] text-slate-400">Reading the PDF...</p>
        ) : null}
        {pdfStatus === "error" ? (
          <p className="mt-1 max-w-[16rem] text-[11px] leading-4 text-amber-700" title={pdfError || undefined}>
            Couldn&apos;t read the PDF text. Chat still works, but answers may be less specific.
          </p>
        ) : null}
        {pdfStatus === "empty" ? (
          <p className="mt-1 max-w-[16rem] text-[11px] leading-4 text-amber-700">
            This PDF has no extractable text. Answers may be less specific.
          </p>
        ) : null}
      </div>

      <form className="mt-6" onSubmit={send}>
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-colors focus-within:border-[#8ca1b5]">
          <label className="sr-only" htmlFor="course-chat-start">
            Start a chat
          </label>
          <textarea
            className="w-full resize-none bg-transparent text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400"
            id="course-chat-start"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message to start a chat"
            rows={3}
            value={input}
          />
          <div className="mt-1 flex items-center justify-end">
            <button
              aria-label="Send message"
              className="grid size-9 place-items-center rounded-full bg-[#193b61] text-white transition-colors hover:bg-[#284f77] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61] disabled:cursor-not-allowed disabled:opacity-40"
              disabled={isLoading || !input.trim()}
              type="submit"
            >
              <ArrowUp className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        {error && (
          <p aria-live="polite" className="mt-2 text-xs text-red-700" role="alert">
            {error}
          </p>
        )}
      </form>

      {conversations.length ? (
        <div className="mt-7">
          <h3 className="text-sm font-semibold text-slate-900">Recent Conversations</h3>
          <ul className="mt-3 space-y-2">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <button
                  className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61]"
                  onClick={() => setActiveId(conversation.id)}
                  type="button"
                >
                  <MessageSquare className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{conversation.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
