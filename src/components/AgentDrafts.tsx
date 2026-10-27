"use client";

import { useState } from "react";
import { Check, Download, Notice } from "@/components/dashboard/Icons";
import { StatusPill } from "@/components/dashboard/StatusPill";

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

// Plain-language activity log in place of raw tool names.
function describe(t: Trace): string {
  const name = t.input && typeof t.input === "object" && "name" in t.input ? String((t.input as { name: string }).name) : undefined;
  switch (t.tool) {
    case "get_program":
      return "Read the decided program";
    case "local_places":
      return "Looked up local places in Qloo";
    case "local_taste":
      return "Read the town's local taste signals";
    case "check_partner":
      return name ? `Confirmed ${name} in Qloo's local data` : "Confirmed a partner in Qloo's local data";
    default:
      return name ? `Checked ${name}` : "Checked the program";
  }
}

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

  const activity = Array.from(new Set((result?.trace ?? []).map(describe)));

  return (
    <section data-testid="agent-drafts" aria-busy={state === "loading"} className="no-print mt-10 rounded-lg border border-rule bg-paper">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5 sm:px-6">
        <div className="max-w-xl">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">Next step</p>
          <h2 className="mt-1 font-semibold tracking-tight">Partner outreach</h2>
          <p className="mt-1 text-sm text-muted">
            An OpenAI agent reads the decided program, confirms each partner in Qloo&apos;s local data, and drafts the first email. Rules check every
            draft before you see it. Nothing is sent.
          </p>
        </div>
        <button
          onClick={run}
          disabled={state === "loading"}
          className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-paper transition-colors duration-150 hover:bg-ink/85 active:bg-ink/75 disabled:cursor-progress disabled:opacity-70"
        >
          {state === "loading" && <span aria-hidden className="h-3 w-3 animate-spin rounded-full border-2 border-paper/40 border-t-paper motion-reduce:animate-none" />}
          {state === "loading" ? "Drafting…" : state === "done" ? "Redraft" : "Draft outreach"}
        </button>
      </div>

      <div aria-live="polite">
        {state === "loading" && (
          <div className="border-t border-hairline px-5 py-5 sm:px-6">
            <p className="text-sm text-muted">Reading the program and checking each partner. This takes about 10 seconds.</p>
            <div className="mt-4 space-y-3" aria-hidden>
              {[0, 1].map((i) => (
                <div key={i} className="rounded-md border border-hairline p-4">
                  <div className="skeleton h-4 w-2/5" />
                  <div className="skeleton mt-3 h-3 w-full" />
                  <div className="skeleton mt-2 h-3 w-11/12" />
                  <div className="skeleton mt-2 h-3 w-3/5" />
                </div>
              ))}
            </div>
          </div>
        )}

        {state === "error" && (
          <div className="flex gap-3 border-t border-hairline px-5 py-4 text-sm sm:px-6">
            <Notice className="mt-0.5 h-4 w-4 text-hivis-text" />
            <p>
              <span className="font-medium">The drafting agent is unavailable right now.</span>{" "}
              <span className="text-muted">The program, the partner sheet and the calendar still work. Try again in a moment.</span>
            </p>
          </div>
        )}

        {state === "done" && result && (
          <div className="border-t border-hairline">
            <div className="grid gap-6 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
              <p className="text-sm leading-relaxed">{result.summary}</p>
              {activity.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted">What the agent checked</p>
                  <ol className="mt-2 space-y-1.5 text-xs text-muted" aria-label="What the agent checked">
                    {activity.map((a) => (
                      <li key={a} className="flex gap-2">
                        <Check className="mt-0.5 h-3 w-3 text-ok" />
                        {a}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
            {result.drafts?.length ? (
              <ul className="divide-y divide-hairline border-t border-hairline">
                {result.drafts.map((d, i) => (
                  <li key={i} className="px-5 py-5 sm:px-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-muted">To {d.partner}</p>
                        <p className="mt-0.5 font-medium">{d.subject}</p>
                      </div>
                      {d.checked === "passed" ? (
                        <StatusPill tone="ok">Passed rule check</StatusPill>
                      ) : (
                        <StatusPill tone="warn">Replaced by template</StatusPill>
                      )}
                    </div>
                    {d.note && <p className="mt-1 text-xs text-amber">{d.note}</p>}
                    <pre className="mt-3 whitespace-pre-wrap rounded-md bg-concrete/60 p-4 font-sans text-sm leading-relaxed text-ink/90">{d.body}</pre>
                    <a
                      href={emlHref(d)}
                      download={`${d.partner.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.eml`}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-rule px-3 py-1.5 text-sm transition-colors duration-150 hover:border-ink active:bg-concrete"
                    >
                      <Download />
                      Download .eml
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-t border-hairline px-6 py-6 text-sm text-muted">The agent returned no drafts this time. Try Redraft.</p>
            )}
            <p className="border-t border-hairline px-5 py-3 text-xs text-muted sm:px-6">Drafts only. You review and send each one yourself.</p>
          </div>
        )}
      </div>
    </section>
  );
}
