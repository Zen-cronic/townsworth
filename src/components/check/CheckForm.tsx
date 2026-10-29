"use client";

import { useEffect, useRef, useState } from "react";
import type { Town } from "@/lib/towns";
import type { CheckResult } from "@/lib/userPlan";
import { MAX_CHARS, MIN_CHARS, SAMPLE_PLAN } from "@/lib/userPlanParse";
import { Notice } from "@/components/dashboard/Icons";
import { parseFund, primaryCta, secondaryCta } from "@/components/dashboard/ui";
import { CheckResults } from "./CheckResults";

// Step 2: paste, check, read the result. The text lives only in this component's state and the
// POST body; it is never written to a URL, storage or the console.

type Status = "idle" | "checking" | "done" | "error" | "limited";

const PROGRESS = [
  "Splitting your draft into items with OpenAI…",
  "Reading the town's Qloo taste and place signals…",
  "Looking up the organisations it names on OpenStreetMap…",
  "Checking each line against the town with fixed rules…",
  "Costing local replacements against your fund…",
];

export function CheckForm({ town }: { town: Town }) {
  const [text, setText] = useState("");
  const [fundEdit, setFundEdit] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const inFlight = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const tooLong = text.length > MAX_CHARS;
  const tooShort = text.trim().length < MIN_CHARS;
  const fundValue = fundEdit ?? town.defaultAnnualFund.toLocaleString("en-US");
  // A result for another town is stale once the town changes.
  const shown = result && result.town.slug === town.slug ? result : null;
  const view: Status = status === "done" && !shown ? "idle" : status;

  useEffect(() => {
    if (status !== "checking") return;
    const started = Date.now();
    const id = setInterval(() => {
      const secs = Math.floor((Date.now() - started) / 1000);
      setElapsed(secs);
      setStep(Math.min(PROGRESS.length - 1, Math.floor(secs / 6)));
    }, 1000);
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => () => inFlight.current?.abort(), []);

  useEffect(() => {
    if (status === "done" && shown) resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [status, shown]);

  async function check() {
    if (tooLong || tooShort || status === "checking") return;
    inFlight.current?.abort();
    const ctrl = new AbortController();
    inFlight.current = ctrl;
    setStatus("checking");
    setStep(0);
    setElapsed(0);
    setError("");
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ town: town.slug, fund: parseFund(fundValue), text }),
        cache: "no-store",
        signal: ctrl.signal,
      });
      const body = (await res.json().catch(() => null)) as (CheckResult & { error?: string }) | null;
      if (res.status === 429) {
        setError(body?.error ?? "Too many checks from your network. Try again in a few minutes.");
        setStatus("limited");
      } else if (!res.ok || !body || body.error) {
        setError(body?.error ?? "The check didn't finish. Try again in a minute.");
        setStatus("error");
      } else {
        setResult(body);
        setStatus("done");
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError("The check didn't reach the server. Check your connection and try again.");
      setStatus("error");
    } finally {
      if (inFlight.current === ctrl) inFlight.current = null;
    }
  }

  function clear() {
    inFlight.current?.abort();
    setText("");
    setResult(null);
    setError("");
    setStatus("idle");
  }

  const checking = view === "checking";

  return (
    <>
      <section aria-labelledby="step2-h" className="no-print mt-4 rounded-lg border border-rule bg-paper p-4 sm:p-5">
        <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted">
          <span className="grid h-5 w-5 place-items-center rounded-full border border-rule bg-paper text-[10px] text-ink">2</span>
          Your draft
        </p>
        <h2 id="step2-h" className="mt-2 text-lg font-semibold tracking-tight">
          Paste the plan for {town.name}
        </h2>

        {/* method=post and unnamed fields: even without JavaScript, a submit can't put the text in a URL */}
        <form
          method="post"
          action="/api/check"
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void check();
          }}
        >
          <label htmlFor="plan-text" className="sr-only">
            Plan text
          </label>
          <textarea
            id="plan-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            spellCheck={false}
            autoComplete="off"
            disabled={checking}
            aria-describedby="plan-count plan-disclosure"
            aria-invalid={tooLong || undefined}
            placeholder={"One commitment per line works best, e.g.\n1. Sponsor a STEM summer camp for local students\n2. Host an annual community picnic"}
            className={`block min-h-56 w-full resize-y rounded-md border bg-paper px-3 py-2.5 font-mono text-[13px] leading-relaxed text-ink transition-colors duration-150 placeholder:text-muted/70 hover:border-ink/50 focus:border-ink focus:outline-none disabled:bg-concrete/60 disabled:text-muted ${tooLong ? "border-hivis" : "border-rule"}`}
          />
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <p id="plan-count" aria-live="polite" className={`font-mono tabular-nums ${tooLong ? "font-medium text-hivis-text" : "text-muted"}`}>
              {text.length.toLocaleString("en-US")} / {MAX_CHARS.toLocaleString("en-US")} characters
              {tooLong && ` · ${(text.length - MAX_CHARS).toLocaleString("en-US")} over the limit: trim it before checking`}
            </p>
            <button
              type="button"
              onClick={() => setText(SAMPLE_PLAN)}
              disabled={checking}
              className="rounded text-ink underline decoration-rule underline-offset-4 hover:decoration-ink disabled:text-muted"
            >
              Try a sample plan
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-muted">Annual community fund (USD)</span>
              <span className="flex items-center rounded-md border border-rule bg-paper pl-3 transition-colors duration-150 focus-within:border-ink hover:border-ink/50">
                <span aria-hidden className="font-mono text-muted">
                  $
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={fundValue}
                  onChange={(e) => setFundEdit(e.target.value)}
                  disabled={checking}
                  className="h-10 w-36 bg-transparent px-2 font-mono tabular-nums focus:outline-none focus-visible:outline-none"
                />
              </span>
            </label>
            <button type="submit" disabled={checking || tooLong || tooShort} className={`${primaryCta} h-10 disabled:cursor-not-allowed disabled:bg-ink/40`}>
              {checking ? "Checking…" : "Check this draft"}
            </button>
            <button type="button" onClick={clear} disabled={checking || (!text && !result)} className={`${secondaryCta} h-10 disabled:cursor-not-allowed disabled:text-muted`}>
              Clear
            </button>
            {tooShort && !tooLong && text.length > 0 && <span className="pb-2.5 text-xs text-muted">Paste at least {MIN_CHARS} characters.</span>}
          </div>

          <p id="plan-disclosure" className="mt-4 border-t border-hairline pt-3 text-xs leading-relaxed text-muted">
            Your text is sent to OpenAI to split it into items; organisation names are looked up on OpenStreetMap. Only the town&apos;s coordinates go
            to Qloo. Nothing is stored.
          </p>
        </form>

        <div aria-live="polite" className="empty:hidden">
          {checking && (
            <div role="status" className="mt-4 flex items-start gap-3 rounded-md border border-rule bg-concrete/60 px-4 py-3 text-sm">
              <span aria-hidden className="mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-hivis" />
              <span>
                <span className="font-medium">{PROGRESS[step]}</span>
                <span className="mt-0.5 block text-xs text-muted">
                  Usually 15–30 seconds<span className="font-mono tabular-nums"> · {elapsed} s</span>
                </span>
              </span>
            </div>
          )}
          {view === "error" && (
            <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-hivis/35 bg-hivis-wash px-4 py-3 text-sm">
              <Notice className="h-4 w-4 text-hivis-text" />
              <span className="min-w-0 flex-1">{error}</span>
              <button type="button" onClick={() => void check()} className={secondaryCta}>
                Try again
              </button>
            </div>
          )}
          {view === "limited" && (
            <div role="alert" className="mt-4 flex gap-3 rounded-md border border-amber/35 bg-amber-wash px-4 py-3 text-sm">
              <Notice className="mt-0.5 h-4 w-4 text-amber" />
              <span>
                <span className="font-semibold">Limit reached.</span> {error}
              </span>
            </div>
          )}
        </div>
      </section>

      {view === "done" && shown && (
        <div ref={resultsRef} className="scroll-mt-20">
          <CheckResults result={shown} />
        </div>
      )}
    </>
  );
}
