"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { type FormEvent, useState } from "react";

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed.");
  return body;
}

export default function CreateCoursePage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const data = new FormData(event.currentTarget);
      const created = await jsonRequest<{ course: { id: string } }>("/api/courses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: data.get("title"),
          category: data.get("category"),
          description: data.get("description"),
        }),
      });
      router.push(`/teacher/courses/${created.course.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Course creation failed.");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/teacher" className="inline-flex items-center gap-2 text-sm font-medium text-[#24496f]">
          <ArrowLeft className="size-4" />Back to dashboard
        </Link>
        <form onSubmit={submit} className="mt-5 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <header>
            <h1 className="font-serif text-3xl text-[#142f4d]">Create a course</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Set up the course workspace first. Source materials are added separately when you create each assignment.
            </p>
          </header>
          <label className="block text-sm font-semibold text-[#193b61]">Course title<input required name="title" maxLength={120} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3.5 font-normal outline-none focus:ring-4 focus:ring-[#e8eef4]" /></label>
          <label className="block text-sm font-semibold text-[#193b61]">Category<input name="category" maxLength={80} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3.5 font-normal outline-none focus:ring-4 focus:ring-[#e8eef4]" /></label>
          <label className="block text-sm font-semibold text-[#193b61]">Description<textarea name="description" maxLength={4000} rows={4} className="mt-2 w-full rounded-xl border border-slate-200 p-3.5 font-normal outline-none focus:ring-4 focus:ring-[#e8eef4]" /></label>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button disabled={busy} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#193b61] px-4 text-sm font-semibold text-white disabled:opacity-50">
            {busy && <LoaderCircle className="size-4 animate-spin" />}{busy ? "Creating course…" : "Create course"}
          </button>
        </form>
      </div>
    </main>
  );
}
