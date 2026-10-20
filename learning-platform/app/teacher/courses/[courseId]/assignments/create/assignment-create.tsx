"use client";

import { upload } from "@vercel/blob/client";
import { ArrowLeft, Check, FileText, LoaderCircle, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState } from "react";

type Course = {
  id: string;
  title: string;
  status: string;
  entities: Array<{ id: string; selected: boolean }>;
};
type SourceMode = "documents" | "course";
type UploadedDocument = {
  id: string;
  kind: "FILE";
  name: string;
  mimeType: string;
  size: number;
  blobPathname: string;
};
type UploadFailure = { id: string; name: string; message: string };

const mimeByExtension: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed.");
  return body as T;
}

function fileMime(file: File) {
  return file.type || mimeByExtension[file.name.split(".").pop()?.toLowerCase() || ""] || "text/plain";
}

const steps = ["Sources", "Knowledge", "Brief", "Draft"];

export default function AssignmentCreate({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<SourceMode>("documents");
  const [assignmentId] = useState(() => crypto.randomUUID());
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [uploadFailures, setUploadFailures] = useState<UploadFailure[]>([]);
  const [uploading, setUploading] = useState(false);

  const loadCourse = useCallback(async () => {
    try {
      const result = await api<{ course: Course }>(`/api/courses/${courseId}`);
      setCourse(result.course);
      if (result.course.entities.some((entity) => entity.selected)) setMode("course");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not load course.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { queueMicrotask(() => void loadCourse()); }, [loadCourse]);

  async function chooseFiles(list: FileList | null) {
    const selected = Array.from(list || []);
    if (!selected.length) return;
    if (
      documents.length + selected.length > 2 ||
      documents.reduce((sum, document) => sum + document.size, 0) +
        selected.reduce((sum, file) => sum + file.size, 0) >
        20 * 1024 * 1024
    ) {
      setNotice("Choose at most two documents totaling no more than 20 MiB.");
      return;
    }
    setNotice("");
    setUploadFailures([]);
    setUploading(true);
    const uploaded: UploadedDocument[] = [];
    const failures: UploadFailure[] = [];
    for (const file of selected) {
      try {
        const mimeType = fileMime(file);
        const blob = await upload(
          `learning-platform/courses/${courseId}/assignments/${assignmentId}/${crypto.randomUUID()}/${file.name}`,
          file,
          {
            access: "private",
            handleUploadUrl: "/api/uploads/token",
            clientPayload: JSON.stringify({ courseId, assignmentId, contentType: mimeType, size: file.size }),
          },
        );
        uploaded.push({ id: crypto.randomUUID(), kind: "FILE", name: file.name, mimeType, size: file.size, blobPathname: blob.pathname });
      } catch (error) {
        failures.push({ id: crypto.randomUUID(), name: file.name, message: error instanceof Error ? error.message : "Upload failed." });
      }
    }
    setDocuments((current) => [...current, ...uploaded]);
    setUploadFailures(failures);
    setUploading(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (uploading) return setNotice("Wait for the document upload to finish.");
    if (mode === "documents" && !documents.length) return setNotice("Upload at least one source document.");
    setBusy(true);
    setNotice("");
    try {
      const sources: Array<Record<string, unknown>> = [];
      if (mode === "documents") {
        sources.push(...documents.map(({ kind, name, mimeType, size, blobPathname }) => ({ kind, name, mimeType, size, blobPathname })));
      }
      await api(`/api/courses/${courseId}/assignments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assignmentId, title, sources }),
      });
      router.push(`/teacher/courses/${courseId}/assignments/${assignmentId}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not create assignment.");
      setBusy(false);
    }
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-slate-50"><LoaderCircle className="size-7 animate-spin text-[#193b61]" /></main>;
  const hasCourseKnowledge = Boolean(course?.entities.some((entity) => entity.selected));

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-800">
      <div className="mx-auto max-w-5xl">
        <Link href={`/teacher/courses/${courseId}`} className="inline-flex items-center gap-2 text-sm font-medium text-[#24496f]"><ArrowLeft className="size-4" />Back to course</Link>
        <header className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#54738f]">{course?.title ?? "Course"}</p>
          <h1 className="mt-2 font-serif text-3xl text-[#142f4d]">Create assignment</h1>
          <p className="mt-2 text-sm text-slate-600">Start with assignment sources. You will review knowledge and the brief before any questions are generated.</p>
        </header>
        <nav aria-label="Assignment workflow" className="mt-5 grid grid-cols-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {steps.map((step, index) => <div key={step} className={`flex items-center justify-center gap-2 border-r border-slate-200 px-2 py-3 text-xs font-semibold last:border-r-0 sm:text-sm ${index === 0 ? "bg-[#193b61] text-white" : "text-slate-400"}`}>{index === 0 ? <span className="grid size-5 place-items-center rounded-full bg-white/20">1</span> : <span>{index + 1}</span>}{step}</div>)}
        </nav>
        {notice && <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{notice}</p>}
        {course?.status !== "READY" ? (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center"><h2 className="font-semibold text-[#193b61]">Course is not ready</h2><p className="mt-2 text-sm text-slate-500">Finish the legacy course setup before creating an assignment.</p></section>
        ) : (
          <form onSubmit={submit} className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <label className="block text-sm font-semibold text-[#193b61]">Assignment title<input required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3.5 font-normal outline-none focus:ring-4 focus:ring-[#e8eef4]" /></label>
            <fieldset className="mt-6"><legend className="text-sm font-semibold text-[#193b61]">Choose one source option</legend><div className="mt-3 grid gap-3 md:grid-cols-2">
              <SourceChoice active={mode === "documents"} title="Documents" detail="Up to 2 PDF, TXT, DOCX, or PPTX files" icon={<FileText className="size-5" />} onClick={() => setMode("documents")} />
              <SourceChoice active={mode === "course"} disabled={!hasCourseKnowledge} title="Course knowledge" detail={hasCourseKnowledge ? "Reuse the confirmed course knowledge" : "No confirmed course knowledge available"} icon={<Check className="size-5" />} onClick={() => setMode("course")} />
            </div></fieldset>
            {mode === "documents" && <div className="mt-5"><label className={`flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-[#b9cadb] bg-[#f7fafc] p-5 text-center ${uploading || documents.length >= 2 ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>{uploading ? <LoaderCircle className="size-6 animate-spin text-[#385f88]" /> : <Upload className="size-6 text-[#385f88]" />}<span className="mt-2 text-sm font-semibold text-[#24496f]">{uploading ? "Uploading to private Blob…" : "Upload 1–2 source documents"}</span><span className="mt-1 text-xs text-slate-500">Only successfully uploaded files appear below · 20 MiB combined maximum</span><input disabled={uploading || documents.length >= 2} multiple type="file" accept=".pdf,.txt,.docx,.pptx" className="sr-only" onChange={(event) => { void chooseFiles(event.target.files); event.currentTarget.value = ""; }} /></label>{!!documents.length && <ul aria-label="Uploaded documents" className="mt-3 space-y-2">{documents.map((document) => <li key={document.id} className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm"><Check className="size-4 text-emerald-700" /><span className="min-w-0 truncate">{document.name}</span><span className="ml-auto shrink-0 text-xs text-emerald-800">Uploaded · {(document.size / 1024 / 1024).toFixed(2)} MiB</span></li>)}</ul>}{!!uploadFailures.length && <ul aria-label="Failed document uploads" className="mt-3 space-y-2">{uploadFailures.map((failure) => <li key={failure.id} role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><span className="font-semibold">{failure.name}</span><span className="mt-1 block text-xs">{failure.message}</span></li>)}</ul>}</div>}
            {mode === "course" && <p className="mt-5 rounded-xl border border-[#d8e5f3] bg-[#f2f7fc] p-4 text-sm text-[#24496f]">This assignment will begin with a snapshot of the course knowledge. You can review it before generating.</p>}
            <button disabled={busy || uploading || !title.trim()} className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#193b61] px-4 text-sm font-semibold text-white disabled:opacity-50">{busy && <LoaderCircle className="size-4 animate-spin" />}{busy ? "Creating and processing…" : uploading ? "Uploading sources…" : "Create assignment"}</button>
          </form>
        )}
      </div>
    </main>
  );
}

function SourceChoice({ active, disabled, title, detail, icon, onClick }: { active: boolean; disabled?: boolean; title: string; detail: string; icon: React.ReactNode; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${active ? "border-[#385f88] bg-[#f2f7fc] ring-2 ring-[#d8e5f3]" : "border-slate-200 hover:border-[#9db1c4]"}`}><span className="text-[#385f88]">{icon}</span><span className="mt-3 block text-sm font-semibold text-[#193b61]">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{detail}</span></button>;
}
