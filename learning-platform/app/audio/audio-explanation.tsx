"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageShell } from "@/app/components/page-shell";
import { ArrowLeft, ArrowRight, AudioLines, BookOpen, FileUp, Pause, Play, RotateCcw, Volume2 } from "lucide-react";

import {
  createAudioFingerprint,
  listAudioHistory,
  saveAudioHistoryDocument,
  type AudioHistoryDocument,
  type SavedExplanation,
} from "./audio-history";
import type { PdfDocument } from "./pdf-viewer";

const PdfViewer = dynamic(() => import("./pdf-viewer"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[550px] items-center justify-center rounded-xl bg-slate-300 text-sm text-slate-600">
      Loading PDF viewer...
    </div>
  ),
});

type PdfPage = { text: string; pageNumber: number };
type Explanation = SavedExplanation;
type SpeechWord = { text: string; start: number; end: number };
const noExplainableTextMessage = "no explanable text found in pdf";

function limitContext(value: string, maximum: number) {
  if (value.length <= maximum) return value;
  const suffixLength = Math.floor(maximum / 5);
  return `${value.slice(0, maximum - suffixLength)}\n...\n${value.slice(-suffixLength)}`;
}

function getTimestamp() {
  return new Date().getTime();
}

function isExplanation(value: unknown): value is Explanation {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { explanation?: unknown }).explanation === "string" &&
    typeof (value as { continuesNextPage?: unknown }).continuesNextPage === "boolean"
  );
}

export default function AudioExplanation({ studentId, user }: { studentId: string; user: { id: string; email: string } }) {
  const [fileUrl, setFileUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [history, setHistory] = useState<AudioHistoryDocument[]>([]);
  const [currentDocumentId, setCurrentDocumentId] = useState("");
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [pages, setPages] = useState<PdfPage[]>([]);
  const [pdfPages, setPdfPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [noExplainableText, setNoExplainableText] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [error, setError] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [wordIndex, setWordIndex] = useState(-1);
  const [pdfZoom, setPdfZoom] = useState(1);
  const pdfDocumentRef = useRef<PdfDocument | null>(null);
  const speechRequestRef = useRef(0);
  const speechText = explanation?.explanation ?? "";
  const words = useMemo<SpeechWord[]>(() => {
    const matches = [...speechText.matchAll(/\S+/g)];
    return matches.flatMap((match) => {
      const start = match.index;
      if (start === undefined || !match[0]) return [];
      return [{ text: match[0], start, end: start + match[0].length }];
    });
  }, [speechText]);
  const speechSegments = useMemo(() => speechText.split(/(\s+)/), [speechText]);

  useEffect(() => {
    let active = true;
    void listAudioHistory(studentId)
      .then((documents) => {
        if (active) setHistory(documents);
      })
      .catch(() => {
        if (active) setError("Saved audio history could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [studentId]);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  function applySavedExplanation(document: AudioHistoryDocument, pageNumber: number) {
    const saved = document.explanations[String(pageNumber)] ?? null;
    setExplanation(saved);
    setNoExplainableText(false);
    setWordIndex(-1);
  }

  function openDocument(document: AudioHistoryDocument) {
    stopSpeech();
    setError("");
    setCurrentDocumentId(document.id);
    setFileName(document.name);
    setFileUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(new Blob([document.pdfData], { type: "application/pdf" }));
    });
    setPages([]);
    setPdfPages(document.pageCount);
    setCurrentPage(1);
    setPdfZoom(1);
    pdfDocumentRef.current = null;
    applySavedExplanation(document, 1);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Please choose a PDF study material.");
      return;
    }
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setWordIndex(-1);
    setError("");
    setExplanation(null);
    setNoExplainableText(false);
    setPages([]);
    pdfDocumentRef.current = null;
    setCurrentPage(1);
    setPdfPages(0);
    setPdfZoom(1);
    try {
      const fingerprint = await createAudioFingerprint(file);
      const existing = (await listAudioHistory(studentId)).find((document) => document.fingerprint === fingerprint);
      if (existing) {
        openDocument(existing);
        return;
      }
      const document: AudioHistoryDocument = {
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        fingerprint,
        pageCount: 0,
        pdfData: await file.arrayBuffer(),
        explanations: {},
        updatedAt: getTimestamp(),
      };
      await saveAudioHistoryDocument(studentId, document);
      setHistory((documents) => [document, ...documents]);
      setCurrentDocumentId(document.id);
      setFileName(file.name);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The PDF could not be saved.");
      return;
    }
    setFileUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(file);
    });
  }

  async function handleDocumentLoad(pdf: PdfDocument) {
    setPdfPages(pdf.numPages);
    pdfDocumentRef.current = pdf;
    setPages(Array.from({ length: pdf.numPages }, (_, index) => ({
      pageNumber: index + 1,
      text: "",
    })));
    const document = history.find((item) => item.id === currentDocumentId);
    if (document && document.pageCount !== pdf.numPages) {
      const updated = { ...document, pageCount: pdf.numPages, updatedAt: getTimestamp() };
      await saveAudioHistoryDocument(studentId, updated);
      setHistory((documents) => documents.map((item) => item.id === updated.id ? updated : item));
    }
  }

  async function extractPageText(pageNumber: number) {
    const pdf = pdfDocumentRef.current;
    if (!pdf || pageNumber < 1 || pageNumber > pdf.numPages) return "";
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    return content.items
      .map((item) => (typeof item === "object" && item !== null && "str" in item ? String(item.str) : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  async function explainPage() {
    const document = history.find((item) => item.id === currentDocumentId);
    const saved = document?.explanations[String(currentPage)];
    if (saved) {
      stopSpeech();
      setExplanation(saved);
      return;
    }
    const contextPageNumbers = [currentPage - 1, currentPage, currentPage + 1]
      .filter((pageNumber) => pageNumber >= 1 && pageNumber <= pdfPages);
    setIsExplaining(true);
    setError("");
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setWordIndex(-1);
    try {
      const extracted = await Promise.all(
        contextPageNumbers.map(async (pageNumber) => ({
          pageNumber,
          text: await extractPageText(pageNumber),
        })),
      );
      const page = extracted.find((item) => item.pageNumber === currentPage);
      if (!page?.text) {
        setNoExplainableText(true);
        return;
      }
      const previousPageText = extracted.find((item) => item.pageNumber === currentPage - 1)?.text ?? "";
      const nextPageText = extracted.find((item) => item.pageNumber === currentPage + 1)?.text ?? "";
      const response = await fetch("/api/audio/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageText: limitContext(page.text, 100_000),
          pageNumber: currentPage,
          pageCount: pdfPages,
          previousPageText: previousPageText.slice(-1_200),
          nextPageText: nextPageText.slice(0, 1_200),
        }),
      });
      const result: unknown = await response.json();
      if (
        typeof result === "object" &&
        result !== null &&
        "code" in result &&
        result.code === "NO_EXPLAINABLE_TEXT"
      ) {
        setError("");
        setExplanation(null);
        setNoExplainableText(true);
        return;
      }
      if (!response.ok || !isExplanation(result)) {
        throw new Error(
          typeof result === "object" && result !== null && "error" in result
            ? String(result.error)
            : "The page could not be explained.",
        );
      }
      setNoExplainableText(false);
      setExplanation(result);
      if (document) {
        const updated = {
          ...document,
          explanations: { ...document.explanations, [String(currentPage)]: result },
          updatedAt: getTimestamp(),
        };
        await saveAudioHistoryDocument(studentId, updated);
        setHistory((documents) => documents.map((item) => item.id === updated.id ? updated : item));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The page could not be explained.");
    } finally {
      setIsExplaining(false);
    }
  }

  function stopSpeech() {
    speechRequestRef.current += 1;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setWordIndex(-1);
  }

  function pauseSpeech() {
    speechRequestRef.current += 1;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  }

  function playSpeech() {
    if (!speechText) return;
    const requestId = speechRequestRef.current + 1;
    speechRequestRef.current = requestId;
    window.speechSynthesis.cancel();
    setError("");
    const startWord = wordIndex >= 0 ? wordIndex : 0;
    const startOffset = words[startWord]?.start ?? 0;
    const remainingText = speechText.slice(startOffset);
    const utterance = new SpeechSynthesisUtterance(remainingText);
    utterance.rate = 0.95;
    utterance.onstart = () => {
      if (speechRequestRef.current !== requestId) return;
      setIsPlaying(true);
    };
    utterance.onend = () => {
      if (speechRequestRef.current !== requestId) return;
      setIsPlaying(false);
      setWordIndex(-1);
    };
    utterance.onerror = (event) => {
      if (speechRequestRef.current !== requestId) return;
      setIsPlaying(false);
      if (event.error === "canceled" || event.error === "interrupted") return;
      setError("The browser could not play the explanation. Please try Play again.");
    };
    utterance.onboundary = (event) => {
      if (speechRequestRef.current !== requestId) return;
      if (typeof event.charIndex !== "number") return;
      const absoluteOffset = startOffset + event.charIndex;
      const activeWord = words.reduce(
        (candidate, word, index) => (word.start <= absoluteOffset ? index : candidate),
        -1,
      );
      if (activeWord >= 0) setWordIndex(activeWord);
    };
    window.speechSynthesis.speak(utterance);
  }

  function changePage(nextPage: number) {
    stopSpeech();
    setCurrentPage(nextPage);
    const document = history.find((item) => item.id === currentDocumentId);
    setExplanation(document?.explanations[String(nextPage)] ?? null);
    setNoExplainableText(false);
    setError("");
  }

  return (
    <PageShell breadcrumbs={[{ label: "Audio explanation" }]} homeHref="/student" user={user}>
      <div className="mx-auto max-w-[1300px]">

        <aside
          aria-label="Audio explanation history"
          className={`fixed left-0 top-24 z-30 rounded-r-2xl border border-l-0 border-slate-200 bg-white shadow-lg transition-[width] duration-200 ${
            isHistoryOpen ? "w-72" : "w-12"
          }`}
        >
          <button
            type="button"
            className="flex h-12 w-full items-center justify-center border-b border-slate-200 text-sm font-semibold text-[#193b61] hover:bg-slate-50"
            onClick={() => setIsHistoryOpen((open) => !open)}
            aria-expanded={isHistoryOpen}
          >
            {isHistoryOpen ? "Audio history" : ">"}
          </button>
          {isHistoryOpen ? (
            <div className="max-h-[calc(100vh-10rem)] overflow-y-auto p-3">
              <p className="mb-3 text-xs leading-5 text-slate-500">
                Saved PDFs and explained pages are available here next time.
              </p>
              {history.length ? (
                <ul className="space-y-2">
                  {history.map((document) => {
                    const explainedPages = Object.keys(document.explanations).length;
                    return (
                      <li key={document.id}>
                        <button
                          type="button"
                          onClick={() => openDocument(document)}
                          className={`w-full rounded-xl border p-3 text-left transition-colors hover:bg-slate-50 ${
                            currentDocumentId === document.id
                              ? "border-[#193b61] bg-blue-50"
                              : "border-slate-200"
                          }`}
                        >
                          <span className="block truncate text-sm font-semibold text-[#193b61]">
                            {document.name}
                          </span>
                          <span className="mt-1 block text-xs text-slate-500">
                            {explainedPages} of {document.pageCount || "..."} pages explained
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                  Uploaded PDFs will appear here.
                </p>
              )}
            </div>
          ) : null}
        </aside>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em]">Listen and understand your PDF</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Upload a PDF, select a page, and ask the assistant to explain it in simple spoken language.
              </p>
            </div>
            <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl bg-[#193b61] px-5 text-sm font-semibold text-white shadow-[0_6px_16px_-6px_rgba(25,59,97,0.55)] hover:bg-[#244d78]">
              <FileUp className="size-5" aria-hidden="true" />
              {fileName ? "Choose another PDF" : "Upload PDF"}
              <input className="sr-only" type="file" accept="application/pdf" onChange={(event) => handleFile(event.target.files?.[0])} />
            </label>
          </div>
          {error ? <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p> : null}
        </section>

        {!fileUrl ? (
          <section className="mt-6 flex min-h-80 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <div>
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#d6efe4] text-[#2f6e56]"><BookOpen className="size-7" aria-hidden="true" /></span>
              <p className="mt-3 font-semibold">Upload study material to begin</p>
              <p className="mt-1 text-sm text-slate-500">Your PDF and saved explanations are kept in this browser for your account.</p>
            </div>
          </section>
        ) : (
          <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.72fr)]">
            <section className="order-2 min-w-0 rounded-2xl border border-slate-200 bg-slate-100 p-4 shadow-sm lg:order-1">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="truncate text-sm font-semibold text-[#193b61]">{fileName}</p>
                  <p className="text-xs text-slate-500">Page {currentPage} of {pdfPages || "..."}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setPdfZoom((value) => Math.max(0.75, Number((value - 0.25).toFixed(2))))} disabled={pdfZoom <= 0.75} className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-[#193b61] disabled:cursor-not-allowed disabled:opacity-40">−</button>
                  <span className="min-w-14 text-center text-xs font-semibold text-slate-600">{Math.round(pdfZoom * 100)}%</span>
                  <button type="button" onClick={() => setPdfZoom((value) => Math.min(1.75, Number((value + 0.25).toFixed(2))))} disabled={pdfZoom >= 1.75} className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-[#193b61] disabled:cursor-not-allowed disabled:opacity-40">+</button>
                  <button type="button" onClick={() => setPdfZoom(1)} disabled={pdfZoom === 1} className="hidden h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-[#193b61] disabled:cursor-not-allowed disabled:opacity-40 sm:inline-flex sm:items-center">Fit</button>
                  <button type="button" disabled={currentPage <= 1} onClick={() => changePage(currentPage - 1)} className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-[#193b61] disabled:cursor-not-allowed disabled:opacity-40" aria-label="Previous page"><ArrowLeft className="size-4" /></button>
                  <button type="button" disabled={!pdfPages || currentPage >= pdfPages} onClick={() => changePage(currentPage + 1)} className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-[#193b61] disabled:cursor-not-allowed disabled:opacity-40" aria-label="Next page"><ArrowRight className="size-4" /></button>
                </div>
              </div>
              <div className="flex min-h-[550px] items-start justify-center overflow-auto rounded-xl bg-slate-300 p-4">
                <PdfViewer
                  fileUrl={fileUrl}
                  currentPage={currentPage}
                  zoom={pdfZoom}
                  onLoadSuccess={handleDocumentLoad}
                  onLoadError={() => setError("This PDF could not be opened.")}
                />
              </div>
            </section>

            <section className="order-1 flex min-h-[550px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:order-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[#54738f]">Transcription</p>
                  <h2 className="mt-1 text-xl font-semibold">A simple explanation</h2>
                </div>
                <Volume2 className="size-5 text-[#54738f]" aria-hidden="true" />
              </div>
              <div className="mt-4 min-h-44 flex-1 rounded-xl bg-[#f3f6fa] p-4 text-base leading-8 text-slate-700">
                {noExplainableText ? (
                  <p className="text-sm leading-6 text-slate-500">{noExplainableTextMessage}</p>
                ) : speechText ? (() => {
                  let wordNumber = 0;
                  return speechSegments.map((segment, index) => {
                    if (/^\s+$/.test(segment)) return <span key={`${segment}-${index}`}>{segment}</span>;
                    const currentWord = wordNumber;
                    wordNumber += 1;
                    return <span key={`${segment}-${index}`} className={currentWord === wordIndex ? "rounded bg-amber-200 px-0.5 text-[#142f4d]" : ""}>{segment}</span>;
                  });
                })() : <p className="text-sm leading-6 text-slate-500">Ask for an explanation of the current page.</p>}
              </div>
              {explanation?.continuesNextPage && currentPage < pages.length ? <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm leading-5 text-amber-800">This topic continues on the next page. Flip forward for the rest of the explanation.</p> : null}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button type="button" onClick={explainPage} disabled={isExplaining || !pages.length} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#193b61] px-4 text-sm font-semibold text-white hover:bg-[#244d78] disabled:opacity-50">
                  {isExplaining ? <RotateCcw className="size-4 animate-spin" /> : <AudioLines className="size-4" />}
                  {isExplaining ? "Explaining..." : "Explain this page"}
                </button>
                <button type="button" onClick={isPlaying ? pauseSpeech : playSpeech} disabled={!speechText} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#193b61] px-4 text-sm font-semibold text-[#193b61] disabled:opacity-40">
                  {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
                  {isPlaying ? "Pause" : "Play"}
                </button>
              </div>
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500"><span>Audio progress</span><span>{isPlaying ? "Playing" : speechText ? "Ready" : "No audio yet"}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-[#5b82a7] transition-all" style={{ width: `${speechText && wordIndex >= 0 ? Math.min(100, ((wordIndex + 1) / Math.max(words.length, 1)) * 100) : 0}%` }} /></div>
              </div>
            </section>
          </div>
        )}
      </div>
    </PageShell>
  );
}
