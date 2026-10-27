"use client";

import { useState } from "react";

interface Draft {
  partner: string;
  subject: string;
  body: string;
  checked: "passed" | "replaced";
  note?: string;
}
interface Trace {
  tool: string;
  input: unknown;
  resultSize: number;
}
interface AgentResult {
  model: string;
  summary: string;
  drafts: Draft[];
  trace: Trace[];
  steps: number;
  error?: string;
}

const emlHref = (d: Draft) =>
  `data:message/rfc822;charset=utf-8,${encodeURIComponent(`Subject: ${d.subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${d.body}`)}`;

export function AgentDrafts({ slug, fund }: { slug: string; fund: number }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<AgentResult | null>(null);

  async function run() {
    setState("loading");
    try {
      const res = await fetch(`/api/agent/${slug}?fund=${fund}`, { method: "POST" });
      const data: AgentResult = await res.json();
      setResult(data);
      setState(res.ok ? "done" : "error");
    } catch {
      setResult(null);
      setState("error");
    }
  }

  return (
    <section data-testid="agent-drafts" className="no-print mt-8 rounded-lg border border-rule bg-paper p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Partner outreach</h2>
          <p className="text-sm text-muted">
            An OpenAI agent reads the decided program, confirms each partner in Qloo&apos;s local data, and drafts the first email. Rules check every
            draft before you see it.
          </p>
        </div>
        <button
          onClick={run}
          disabled={state === "loading"}
          className="rounded-md bg-ink px-4 py-2 font-medium text-paper hover:bg-ink/85 disabled:opacity-60"
        >
          {state === "loading" ? "Drafting…" : state === "done" ? "Redraft" : "Draft outreach"}
        </button>
      </div>

      {state === "loading" && <p className="mt-4 text-sm text-muted">Reading the program and checking partners. This takes about 10 seconds.</p>}
      {state === "error" && (
        <p className="mt-4 rounded-md bg-hivis-wash px-3 py-2 text-sm text-hivis-text">
          {result?.error ?? "The drafting agent is unavailable right now. The program and exports still work."}
        </p>
      )}

      {state === "done" && result && (
        <div className="mt-5 space-y-4">
          <p className="text-sm leading-relaxed">{result.summary}</p>
          <ol className="flex flex-wrap gap-1.5 font-mono text-xs text-muted" aria-label="Agent tool calls">
            {result.trace.map((t, i) => (
              <li key={i} className="rounded border border-hairline bg-concrete px-2 py-0.5">
                {i + 1}. {t.tool}
                {t.input && typeof t.input === "object" && "name" in t.input ? `(${String((t.input as { name: string }).name)})` : "()"}
              </li>
            ))}
          </ol>
          {result.drafts.map((d, i) => (
            <article key={i} className="rounded-md border border-hairline p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-medium">{d.subject}</div>
                <span className={`text-xs ${d.checked === "passed" ? "text-ok-text" : "text-amber"}`}>
                  {d.checked === "passed" ? "✓ Passed rule check" : "Replaced by template"}
                </span>
              </div>
              {d.note && <p className="mt-1 text-xs text-amber">{d.note}</p>}
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-ink/90">{d.body}</pre>
              <a href={emlHref(d)} download={`${d.partner.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.eml`} className="mt-2 inline-block text-sm underline">
                Download .eml
              </a>
            </article>
          ))}
          <p className="text-xs text-muted">Model: OpenAI {result.model}. Drafts only; nothing is sent.</p>
        </div>
      )}
    </section>
  );
}
