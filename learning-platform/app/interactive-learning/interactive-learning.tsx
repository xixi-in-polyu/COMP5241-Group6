"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import {
  runEngineeringScenario,
  type ScenarioInput,
  type ScenarioRequester,
  type ScenarioResult,
} from "@/lib/interactive-learning/scenarios";

type Tab = "requirements" | "reliability" | "workshop";
type ChatMessage = { role: "user" | "assistant"; content: string };
type DefectReport = {
  scenario: string;
  input: string;
  actual: string;
  title: string;
  steps: string;
  expected: string;
  severity: string;
};

const initialClientMessage = `Hello! We need a system to help us manage our staff attendance and schedules. Here is what I would like it to do:

- Staff should be able to clock in and out and check their work hours and schedules.
- Managers should create and update shifts, assign staff, and review attendance.
- Staff should report missed or incorrect punches for manager approval.
- The system should total regular and overtime hours for each pay period.
- Staff should request time off, and managers should approve or decline requests.
- Staff should get shift reminders and notifications when schedules or requests change.
- Managers should see who is working and review attendance summaries.
- Administrators should manage staff accounts and assign roles.
- Managers should prepare approved hours for payroll.

Could you help me figure out what details we should decide for each of these?`;

const tabs: { id: Tab; label: string }[] = [
  { id: "requirements", label: "Requirements Analysis" },
  { id: "reliability", label: "Reliability Lab" },
  { id: "workshop", label: "Code Workshop" },
];

const panelClass = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-100";
const primaryButtonClass =
  "rounded-lg bg-[#193b61] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#244d78] disabled:cursor-wait disabled:opacity-60";

function errorText(value: unknown, fallback: string) {
  return typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
    ? value.error
    : fallback;
}

async function requestAi(body: Record<string, unknown>) {
  const response = await fetch("/api/interactive-learning", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result: unknown = await response.json();
  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? "Sign in as a student to use the AI activities."
        : errorText(result, "The AI activity could not be completed."),
    );
  }
  if (
    typeof result !== "object" ||
    result === null ||
    !("answer" in result) ||
    typeof result.answer !== "string"
  ) {
    throw new Error("The AI service returned an invalid response.");
  }
  return result.answer;
}

function ErrorNotice({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
      role="alert"
    >
      <p>{message}</p>
      {message.includes("Sign in as a student") && (
        <Link className="mt-2 inline-block font-semibold underline" href="/">
          Go to student sign in
        </Link>
      )}
    </div>
  );
}

function RequirementsTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: initialClientMessage },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || busy) return;

    const updated = [...messages, { role: "user" as const, content }];
    setMessages(updated);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const answer = await requestAi({ action: "requirements", messages: updated });
      setMessages([...updated, { role: "assistant", content: answer }]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The AI activity could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)]">
      <div className={panelClass}>
        <h2 className="text-xl font-bold text-[#193b61]">Requirements interview</h2>
        <p className="mt-1 text-sm text-slate-600">
          You are the software engineer; the AI plays a non-technical client.
          Ask questions to uncover edge cases and business constraints.
        </p>
        <div
          aria-live="polite"
          className="mt-4 flex max-h-[440px] flex-col gap-3 overflow-y-auto rounded-xl bg-slate-50 p-3"
        >
          {messages.map((message, index) => (
            <article
              className={`max-w-[95%] whitespace-pre-wrap rounded-xl p-3 text-sm leading-6 ${
                message.role === "assistant"
                  ? "self-start border border-slate-200 bg-white"
                  : "self-end bg-blue-50"
              }`}
              key={`${message.role}-${index}`}
            >
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {message.role === "assistant" ? "Client / mentor" : "You"}
              </p>
              {message.content}
            </article>
          ))}
        </div>
        <form className="mt-4" onSubmit={send}>
          <label className="text-sm font-medium" htmlFor="requirements-question">
            Your question
          </label>
          <textarea
            className={inputClass}
            disabled={busy}
            id="requirements-question"
            maxLength={8_000}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about priorities, workflows, edge cases, or engineering trade-offs..."
            required
            rows={3}
            value={input}
          />
          <button className={`${primaryButtonClass} mt-3`} disabled={busy}>
            {busy ? "Waiting for the client..." : "Send question"}
          </button>
        </form>
        <ErrorNotice message={error} />
      </div>
      <aside className={panelClass}>
        <h2 className="text-lg font-bold text-[#193b61]">Live requirements notes</h2>
        <p className="mt-1 text-sm text-slate-600">
          Client statements are listed in conversation order.
        </p>
        <ol className="mt-4 max-h-[540px] list-decimal space-y-3 overflow-y-auto pl-5 text-sm leading-6">
          {messages
            .filter((message) => message.role === "assistant")
            .map((message, index) => (
              <li className="whitespace-pre-wrap" key={index}>
                {message.content}
              </li>
            ))}
        </ol>
      </aside>
    </section>
  );
}

function ReliabilityTab() {
  const [scenario, setScenario] = useState<ScenarioInput["scenario"]>(
    "duplicate-payroll",
  );
  const [amount, setAmount] = useState(850);
  const [deliveries, setDeliveries] = useState(2);
  const [role, setRole] = useState<"Employee" | "Manager">("Employee");
  const [requester, setRequester] = useState<ScenarioRequester>("EMP-104");
  const [target, setTarget] = useState<"EMP-104" | "EMP-208">("EMP-208");
  const [databaseAvailable, setDatabaseAvailable] = useState(false);
  const [migrationCompatible, setMigrationCompatible] = useState(true);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [lastInput, setLastInput] = useState<ScenarioInput | null>(null);
  const [reportTitle, setReportTitle] = useState("");
  const [reportSteps, setReportSteps] = useState("");
  const [reportExpected, setReportExpected] = useState("");
  const [severity, setSeverity] = useState("Medium");
  const [reports, setReports] = useState<DefectReport[]>([]);
  const [error, setError] = useState("");

  function changeRole(nextRole: "Employee" | "Manager") {
    setRole(nextRole);
    setRequester(nextRole === "Employee" ? "EMP-104" : "MGR-1");
  }

  function runScenario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      let input: ScenarioInput;
      if (scenario === "duplicate-payroll") {
        input = { scenario, amount, deliveries };
      } else if (scenario === "cross-employee-access") {
        input = { scenario, role, requester, target };
      } else {
        input = { scenario, databaseAvailable, migrationCompatible };
      }
      setLastInput(input);
      setResult(runEngineeringScenario(input));
    } catch (scenarioError) {
      setError(
        scenarioError instanceof Error
          ? scenarioError.message
          : "The scenario input is invalid.",
      );
    }
  }

  function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!result || !lastInput) return;
    setReports((current) => [
      ...current,
      {
        scenario: lastInput.scenario,
        input: JSON.stringify(lastInput),
        actual: result.observed,
        title: reportTitle.trim(),
        steps: reportSteps.trim(),
        expected: reportExpected.trim(),
        severity,
      },
    ]);
    setReportTitle("");
    setReportSteps("");
    setReportExpected("");
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]">
      <div className={panelClass}>
        <h2 className="text-xl font-bold text-[#193b61]">Reliability workbench</h2>
        <p className="mt-1 text-sm text-slate-600">
          Try deterministic simulations with seeded defects. No account or AI
          configuration is needed for this lab.
        </p>
        <form className="mt-5 space-y-4" onSubmit={runScenario}>
          <label className="block text-sm font-medium" htmlFor="scenario">
            Engineering scenario
            <select
              className={inputClass}
              id="scenario"
              onChange={(event) =>
                setScenario(event.target.value as ScenarioInput["scenario"])
              }
              value={scenario}
            >
              <option value="duplicate-payroll">Duplicate payroll event</option>
              <option value="cross-employee-access">Cross-employee data access</option>
              <option value="deployment-readiness">Unready deployment</option>
            </select>
          </label>
          {scenario === "duplicate-payroll" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Payroll event amount ($)
                <input
                  className={inputClass}
                  max={10_000_000}
                  min={0.01}
                  onChange={(event) => setAmount(Number(event.target.value))}
                  required
                  step={0.01}
                  type="number"
                  value={amount}
                />
              </label>
              <label className="text-sm font-medium">
                Deliveries (including retries)
                <input
                  className={inputClass}
                  max={10}
                  min={1}
                  onChange={(event) => setDeliveries(Number(event.target.value))}
                  required
                  type="number"
                  value={deliveries}
                />
              </label>
            </div>
          )}
          {scenario === "cross-employee-access" && (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm font-medium">
                Signed-in role
                <select
                  className={inputClass}
                  onChange={(event) => changeRole(event.target.value as "Employee" | "Manager")}
                  value={role}
                >
                  <option>Employee</option>
                  <option>Manager</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                Principal ID
                <select
                  className={inputClass}
                  onChange={(event) =>
                    setRequester(event.target.value as ScenarioRequester)
                  }
                  value={requester}
                >
                  {(role === "Employee" ? ["EMP-104", "EMP-208"] : ["MGR-1", "MGR-2"]).map(
                    (id) => <option key={id}>{id}</option>,
                  )}
                </select>
              </label>
              <label className="text-sm font-medium">
                Requested employee
                <select
                  className={inputClass}
                  onChange={(event) =>
                    setTarget(event.target.value as "EMP-104" | "EMP-208")
                  }
                  value={target}
                >
                  <option>EMP-104</option>
                  <option>EMP-208</option>
                </select>
              </label>
            </div>
          )}
          {scenario === "deployment-readiness" && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={databaseAvailable}
                  onChange={(event) => setDatabaseAvailable(event.target.checked)}
                  type="checkbox"
                />
                Database is available
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={migrationCompatible}
                  onChange={(event) => setMigrationCompatible(event.target.checked)}
                  type="checkbox"
                />
                Database schema is compatible with this release
              </label>
            </div>
          )}
          <button className={primaryButtonClass}>Run scenario</button>
        </form>

        {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}
        {result && (
          <div className="mt-5 space-y-4" aria-live="polite">
            <p
              className={`rounded-lg p-3 text-sm font-semibold ${
                result.defect
                  ? "bg-red-50 text-red-800"
                  : "bg-emerald-50 text-emerald-800"
              }`}
            >
              {result.defect ? "Defect reproduced: " : "Scenario result: "}
              {result.summary}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <pre className="overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs leading-5">
                <strong>Observed</strong>{"\n"}{result.observed}
              </pre>
              <pre className="overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs leading-5">
                <strong>Expected</strong>{"\n"}{result.expected}
              </pre>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm">
              <strong>Engineering concepts</strong>
              <p className="mt-1">{result.concepts}</p>
            </div>
          </div>
        )}
      </div>
      <div className={panelClass}>
        <h2 className="text-lg font-bold text-[#193b61]">Defect report</h2>
        <p className="mt-1 text-sm text-slate-600">
          Reproduce the issue and record how it can be verified. Reports remain
          in this browser session only.
        </p>
        <form className="mt-4 space-y-3" onSubmit={submitReport}>
          <label className="block text-sm font-medium">
            Title
            <input className={inputClass} onChange={(event) => setReportTitle(event.target.value)} required value={reportTitle} />
          </label>
          <label className="block text-sm font-medium">
            Reproduction steps
            <textarea className={inputClass} onChange={(event) => setReportSteps(event.target.value)} required rows={3} value={reportSteps} />
          </label>
          <label className="block text-sm font-medium">
            Expected behavior
            <textarea className={inputClass} onChange={(event) => setReportExpected(event.target.value)} required rows={2} value={reportExpected} />
          </label>
          <label className="block text-sm font-medium">
            Severity
            <select className={inputClass} onChange={(event) => setSeverity(event.target.value)} value={severity}>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
              <option>Critical</option>
            </select>
          </label>
          <button className={primaryButtonClass} disabled={!result}>
            Record defect report
          </button>
        </form>
        <h3 className="mt-6 font-semibold">Submitted reports ({reports.length})</h3>
        {reports.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Your reports will appear here.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {reports.map((report, index) => (
              <li className="rounded-lg border border-slate-200 p-3 text-sm" key={`${report.title}-${index}`}>
                <strong>[{report.severity}] {report.title}</strong>
                <p className="mt-2 text-slate-600">
                  Scenario: {report.scenario} · Inputs: {report.input}
                </p>
                <p className="mt-2 whitespace-pre-wrap">{report.steps}</p>
                <p className="mt-1 text-slate-600">Expected: {report.expected}</p>
                <pre className="mt-1 whitespace-pre-wrap text-xs text-slate-600">
                  Actual: {report.actual}
                </pre>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function WorkshopTab() {
  const [featureRequest, setFeatureRequest] = useState("");
  const [technologyStack, setTechnologyStack] = useState("TypeScript, Next.js");
  const [generated, setGenerated] = useState("");
  const [code, setCode] = useState("");
  const [review, setReview] = useState("");
  const [busy, setBusy] = useState<"generate" | "review" | null>(null);
  const [error, setError] = useState("");

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("generate");
    setError("");
    setReview("");
    try {
      const answer = await requestAi({
        action: "generate",
        featureRequest,
        technologyStack,
      });
      setGenerated(answer);
      const match = answer.match(/```(?:[A-Za-z0-9_+#.-]+)?\s*\n([\s\S]*?)```/);
      setCode(match?.[1]?.trim() ?? answer);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The AI activity could not be completed.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("review");
    setError("");
    try {
      setReview(
        await requestAi({
          action: "review",
          featureRequest,
          technologyStack,
          code,
        }),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The AI activity could not be completed.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="grid gap-5 lg:grid-cols-2">
      <div className={panelClass}>
        <h2 className="text-xl font-bold text-[#193b61]">Requirements-to-code workshop</h2>
        <p className="mt-1 text-sm text-slate-600">
          Generate TypeScript starter code, edit it yourself, and request
          evidence-based correction analysis.
        </p>
        <form className="mt-4 space-y-3" onSubmit={generate}>
          <label className="block text-sm font-medium">
            Describe the feature
            <textarea
              className={inputClass}
              maxLength={10_000}
              onChange={(event) => setFeatureRequest(event.target.value)}
              placeholder="Example: Add a student API endpoint for submitting an attendance correction request."
              required
              rows={5}
              value={featureRequest}
            />
          </label>
          <label className="block text-sm font-medium">
            Language, framework, and constraints
            <input
              className={inputClass}
              maxLength={1_000}
              onChange={(event) => setTechnologyStack(event.target.value)}
              value={technologyStack}
            />
          </label>
          <button className={primaryButtonClass} disabled={busy !== null}>
            {busy === "generate" ? "Generating..." : "Generate starter code"}
          </button>
        </form>
        <ErrorNotice message={error} />
        {generated && (
          <div className="mt-5 rounded-xl bg-slate-50 p-4">
            <h3 className="font-semibold">AI-generated starter</h3>
            <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap text-sm leading-6">
              {generated}
            </pre>
          </div>
        )}
      </div>
      <div className={panelClass}>
        <h2 className="text-lg font-bold text-[#193b61]">Student coding area</h2>
        <p className="mt-1 text-sm text-slate-600">
          Inspect the starter, make your own changes, then submit your version.
        </p>
        <form className="mt-4" onSubmit={analyze}>
          <label className="text-sm font-medium" htmlFor="student-code">
            Editable code
          </label>
          <textarea
            className={`${inputClass} font-mono`}
            id="student-code"
            maxLength={30_000}
            onChange={(event) => setCode(event.target.value)}
            required
            rows={16}
            value={code}
          />
          <button
            className={`${primaryButtonClass} mt-3`}
            disabled={busy !== null || !featureRequest.trim()}
          >
            {busy === "review" ? "Analyzing..." : "Submit for correction analysis"}
          </button>
        </form>
        {review && (
          <div className="mt-5 rounded-xl bg-blue-50 p-4">
            <h3 className="font-semibold">Correction analysis</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{review}</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default function InteractiveLearning() {
  const [activeTab, setActiveTab] = useState<Tab>("requirements");

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-800 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#193b61]">
              Interactive Learning
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Practice requirements discovery, reliability testing, and code review.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-[#193b61] hover:bg-slate-100"
              href="/"
            >
              Student sign in
            </Link>
            <Link
              className="rounded-lg bg-[#193b61] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#244d78]"
              href="/student"
            >
              Student home
            </Link>
          </div>
        </header>

        <p className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-950">
          Reliability simulations are available to everyone. The AI interview
          and code workshop require a student account and configured AI provider.
        </p>

        <div
          aria-label="Interactive learning activities"
          className="mb-5 flex flex-wrap gap-2"
          role="tablist"
        >
          {tabs.map((tab) => (
            <button
              aria-controls={`panel-${tab.id}`}
              aria-selected={activeTab === tab.id}
              className={`rounded-lg px-4 py-2.5 text-sm font-semibold ${
                activeTab === tab.id
                  ? "bg-[#193b61] text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
              }`}
              id={`tab-${tab.id}`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div
          aria-labelledby={`tab-${activeTab}`}
          id={`panel-${activeTab}`}
          role="tabpanel"
        >
          {activeTab === "requirements" && <RequirementsTab />}
          {activeTab === "reliability" && <ReliabilityTab />}
          {activeTab === "workshop" && <WorkshopTab />}
        </div>
      </div>
    </main>
  );
}
