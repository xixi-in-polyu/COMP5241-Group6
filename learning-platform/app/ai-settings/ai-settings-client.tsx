"use client";

import { useState } from "react";
import { KeyRound, Trash2 } from "lucide-react";

import {
  clearPersonalAiCredentials,
  savePersonalAiCredentials,
} from "@/app/components/personal-ai-credentials";
import type { PersonalAiProvider } from "@/lib/ai/personal-credentials";

const endpoints: Record<Exclude<PersonalAiProvider, "compatible">, string> = {
  openrouter: "https://openrouter.ai/api/v1",
  deepseek: "https://api.deepseek.com",
  openai: "https://api.openai.com/v1",
};

const defaultModels: Record<Exclude<PersonalAiProvider, "compatible">, string> = {
  openrouter: "openrouter/free",
  deepseek: "deepseek-chat",
  openai: "gpt-4.1-mini",
};

export function AiSettingsClient() {
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState<PersonalAiProvider>("openrouter");
  const [endpoint, setEndpoint] = useState(endpoints.openrouter);
  const [model, setModel] = useState("openrouter/free");
  const [message, setMessage] = useState("");

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const key = apiKey.trim();
    const selectedModel = model.trim();
    if (!key || !selectedModel) {
      setMessage("Enter an endpoint, API key, and model.");
      return;
    }
    savePersonalAiCredentials({ apiKey: key, model: selectedModel, provider, endpoint: endpoint.trim() });
    setMessage("Your personal AI settings are active in this browser tab.");
  }

  function clear() {
    clearPersonalAiCredentials();
    setApiKey("");
    setProvider("openrouter");
    setEndpoint(endpoints.openrouter);
    setModel("openrouter/free");
    setMessage("Using the platform's shared OpenRouter configuration.");
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-blue-50 p-3 text-blue-700"><KeyRound className="size-6" /></div>
        <div>
          <h1 className="text-2xl font-bold text-[#193b61]">Personal AI settings</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Use your own provider account for GPTutor and mini-course generation. Leave this unset to use the platform&apos;s shared OpenRouter quota.
          </p>
        </div>
      </div>

      <form className="mt-6 space-y-5" onSubmit={save}>
        <label className="block text-sm font-semibold text-slate-800">
          Provider
          <select
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
            onChange={(event) => {
              const next = event.target.value as PersonalAiProvider;
              setProvider(next);
              if (next !== "compatible") {
                setEndpoint(endpoints[next]);
                setModel(defaultModels[next]);
              } else {
                setEndpoint("");
                setModel("");
              }
            }}
            value={provider}
          >
            <option value="openrouter">OpenRouter</option>
            <option value="deepseek">DeepSeek</option>
            <option value="openai">OpenAI</option>
            <option value="compatible">Approved compatible API</option>
          </select>
        </label>

        <label className="block text-sm font-semibold text-slate-800">
          API endpoint
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-sm text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
            disabled={provider !== "compatible"}
            onChange={(event) => setEndpoint(event.target.value)}
            placeholder="https://provider.example/v1"
            type="url"
            value={endpoint}
          />
          <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
            Official provider endpoints are fixed. A compatible endpoint must first be approved by the platform administrator.
          </span>
        </label>

        <label className="block text-sm font-semibold text-slate-800">
          API key
          <input
            autoComplete="off"
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-sm text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="Your provider API key"
            type="password"
            value={apiKey}
          />
        </label>

        <label className="block text-sm font-semibold text-slate-800">
          Model
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-sm text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
            onChange={(event) => setModel(event.target.value)}
            placeholder="openrouter/free or provider/model"
            value={model}
          />
          <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
            Enter the provider&apos;s model ID, for example <code>openrouter/free</code>, <code>deepseek-chat</code>, or <code>gpt-4.1-mini</code>.
          </span>
        </label>

        <div className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          Your key is stored only in this browser tab&apos;s session storage. It is sent over HTTPS only when you make an AI request, is not saved to the platform database, and is cleared when this tab is closed.
        </div>

        {message ? <p aria-live="polite" className="text-sm text-slate-700">{message}</p> : null}

        <div className="flex flex-wrap gap-3">
          <button className="rounded-lg bg-[#193b61] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#244d78]" type="submit">
            Save for this tab
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={clear} type="button">
            <Trash2 className="size-4" /> Use shared quota
          </button>
        </div>
      </form>
    </section>
  );
}
