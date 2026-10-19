import { put } from "@vercel/blob";
import { strToU8, zipSync } from "fflate";

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3011";
function required(name: string) { const value = process.env[name]; if (!value) throw new Error(`${name} is required.`); return value; }
const email = required("SMOKE_TEACHER_EMAIL");
const password = required("SMOKE_TEACHER_PASSWORD");
required("BLOB_READ_WRITE_TOKEN");

const lesson = "Human-computer interaction studies how people understand and use interactive systems. Designers collect evidence about users, tasks, and contexts. Usability evaluation examines effectiveness, efficiency, and satisfaction. Iterative design uses findings to improve an interface and then evaluates the revision. Accessibility removes barriers so people with different abilities can complete meaningful goals. ".repeat(5);

function pdf(text: string) {
  const words = text.split(/\s+/); const lines: string[] = []; let line = "";
  for (const word of words) { if (`${line} ${word}`.trim().length > 72) { lines.push(line); line = word; } else line = `${line} ${word}`.trim(); }
  if (line) lines.push(line);
  const commands = lines.map((value, index) => `(${value.replace(/[()\\]/g, (character) => `\\${character}`)}) Tj${index < lines.length - 1 ? " 0 -12 Td" : ""}`).join("\n");
  const stream = `BT /F1 10 Tf 40 740 Td\n${commands}\nET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let output = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(output)); output += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output);
}

const files = [
  { name: "hci-notes.txt", type: "text/plain", body: Buffer.from(lesson) },
  { name: "hci-reading.pdf", type: "application/pdf", body: pdf(lesson) },
  { name: "hci-handout.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", body: Buffer.from(zipSync({ "word/document.xml": strToU8(`<w:document><w:body><w:p><w:r><w:t>${lesson}</w:t></w:r></w:p></w:body></w:document>`) })) },
  { name: "hci-slides.pptx", type: "application/vnd.openxmlformats-officedocument.presentationml.presentation", body: Buffer.from(zipSync({ "ppt/slides/slide1.xml": strToU8(`<p:sld><a:t>${lesson}</a:t></p:sld>`) })) },
];

const login = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password, role: "teacher" }) });
if (!login.ok) throw new Error(`Login failed: ${login.status} ${await login.text()}`);
const cookie = login.headers.get("set-cookie")?.split(";")[0];
if (!cookie) throw new Error("Login did not return a session cookie.");
const sessionCookie = cookie;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { cookie: sessionCookie, ...(init?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path}: ${response.status} ${JSON.stringify(body)}`);
  return body as T;
}

async function waitFor<T>(load: () => Promise<T>, done: (value: T) => boolean, label: string, timeoutMs = 360_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) { const value = await load(); if (done(value)) return value; await new Promise((resolve) => setTimeout(resolve, 3000)); }
  throw new Error(`${label} timed out.`);
}

const courseIds: string[] = [];
for (const pair of [files.slice(0, 2), files.slice(2)]) {
  const created = await request<{ course: { id: string } }>("/api/courses", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: `HCI smoke ${pair[0].name}`, description: "Cloud integration smoke test." }) });
  courseIds.push(created.course.id);
  const materials = [];
  for (const file of pair) {
    const blob = await put(`learning-platform/courses/${created.course.id}/smoke/${file.name}`, file.body, { access: "private", contentType: file.type, addRandomSuffix: true });
    materials.push({ name: file.name, mimeType: file.type, size: file.body.byteLength, blobPathname: blob.pathname });
  }
  await request(`/api/courses/${created.course.id}/materials`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ materials }) });
  const settled = await waitFor(() => request<{ course: { status: string; error?: string } }>(`/api/courses/${created.course.id}`), (value) => ["AWAITING_ENTITY_REVIEW", "AWAITING_MATERIAL_FIX", "FAILED"].includes(value.course.status), `course ${created.course.id}`);
  if (settled.course.status !== "AWAITING_ENTITY_REVIEW") throw new Error(`Ingestion failed: ${settled.course.status} ${settled.course.error || ""}`);
}

const primary = await request<{ course: { entityRevision: number; entities: unknown[] } }>(`/api/courses/${courseIds[0]}`);
const saved = await request<{ revision: number }>(`/api/courses/${courseIds[0]}/entities`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ revision: primary.course.entityRevision, entities: primary.course.entities }) });
await request(`/api/courses/${courseIds[0]}/entities/confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ revision: saved.revision }) });
const generated = await request<{ assignmentId: string }>(`/api/courses/${courseIds[0]}/assignments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Twenty-question smoke assignment", instructions: "Create grounded questions covering definitions and applied usability decisions.", count: 20, types: ["single_choice", "multi_choice", "fill_blank", "short_answer"], difficulty: { easy: 30, medium: 50, hard: 20 }, objectives: ["knowledge", "comprehension", "application"], coverageEntityIds: [] }) });
const assignment = await waitFor(() => request<{ assignment: { status: string; questions: unknown[]; failedSlots: unknown[]; error?: string } }>(`/api/assignments/${generated.assignmentId}`), (value) => value.assignment.status !== "GENERATING", "20-question assignment", 600_000);
if (assignment.assignment.status !== "DRAFT") throw new Error(`Generation failed: ${assignment.assignment.error || assignment.assignment.status}`);
const current = await request<{ assignment: { version: number; questions: unknown[] } }>(`/api/assignments/${generated.assignmentId}`);
const savedDraft = await request<{ version: number }>(`/api/assignments/${generated.assignmentId}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ version: current.assignment.version, questions: current.assignment.questions }) });
await request(`/api/assignments/${generated.assignmentId}/submit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ version: savedDraft.version }) });
const locked = await fetch(`${baseUrl}/api/assignments/${generated.assignmentId}`, { method: "PUT", headers: { cookie: sessionCookie, "content-type": "application/json" }, body: JSON.stringify({ version: savedDraft.version + 1, questions: current.assignment.questions }) });
if (locked.status !== 409) throw new Error(`Submitted assignment was not locked; save returned ${locked.status}.`);
console.log(JSON.stringify({ courseIds, assignmentId: generated.assignmentId, generatedQuestions: assignment.assignment.questions.length, failedSlots: assignment.assignment.failedSlots.length, submittedAndLocked: true }));
