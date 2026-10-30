"use client";

import { useEffect, useRef, useState } from "react";
import type { Town } from "@/lib/towns";
import type { CheckResult } from "@/lib/userPlan";
import { SAMPLE_PLANS, type SamplePlan } from "@/lib/samplePlans";
import { MAX_CHARS, MIN_CHARS } from "@/lib/userPlanParse";
import { Notice } from "@/components/dashboard/Icons";
import { parseFund, primaryCta, secondaryCta, tertiaryCta } from "@/components/dashboard/ui";
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

// `sample` pre-fills the textarea from /check?sample=<id>, and again whenever the link names a
// different sample (the form stays mounted across query changes); nothing is checked until the
// visitor presses the button. `townSample` is what "Try a sample plan" fills: the selected town's own
// sample, or the generic one.
export function CheckForm({ town, sample, townSample }: { town: Town; sample?: SamplePlan; townSample: SamplePlan }) {
  const [text, setText] = useState(sample?.text ?? "");
  const [shownSample, setShownSample] = useState(sample?.id);
  if (sample && sample.id !== shownSample) {
    setShownSample(sample.id);
    setText(sample.text);
  }
  // Pasted text survives a town switch, but a sample written for another town's organisations would
  // be checked against the wrong place, so it is swapped for the new town's sample.
  const [shownTown, setShownTown] = useState(town.slug);
  if (town.slug !== shownTown) {
    setShownTown(town.slug);
    if (SAMPLE_PLANS.some((s) => s.town && s.town !== town.slug && s.text === text)) setText(townSample.text);
  }
  const [fundEdit, setFundEdit] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [httpStatus, setHttpStatus] = useState(0);
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

  // The result takes focus, so keyboard and screen-reader users land on it; the scroll is instant
  // when the reader asked for reduced motion.
  useEffect(() => {
    if (status !== "done" || !shown) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultsRef.current?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    const heading = resultsRef.current?.querySelector<HTMLElement>("h2");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
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
    setHttpStatus(0);
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
        setHttpStatus(res.status);
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

  // Stops a check in flight. The pasted text stays.
  function stop() {
    inFlight.current?.abort();
    inFlight.current = null;
    setStatus(result ? "done" : "idle");
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
      <section aria-labelledby="step2-h" className="no-print ui-card mt-4 p-4 sm:p-6">
        <p className="lp-kicker">Your draft</p>
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
            rows={8}
            spellCheck={false}
            autoComplete="off"
            disabled={checking}
            aria-describedby="plan-count plan-disclosure"
            aria-invalid={tooLong || undefined}
            placeholder={"One commitment per line works best, e.g.\n1. Sponsor a STEM summer camp for local students\n2. Host an annual community picnic"}
            className={`block min-h-44 w-full resize-y rounded-md border bg-paper px-3 py-2.5 font-mono text-[13px] leading-relaxed text-ink transition-colors duration-150 placeholder:text-muted/70 hover:border-ink/50 focus:border-ink focus:outline-none disabled:bg-concrete/60 disabled:text-muted ${tooLong ? "border-amber" : "border-rule"}`}
          />
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <p id="plan-count" aria-live="polite" className={`font-mono tabular-nums ${tooLong ? "font-medium text-amber" : "text-muted"}`}>
              {text.length.toLocaleString("en-US")} / {MAX_CHARS.toLocaleString("en-US")} characters
              {tooLong && ` · ${(text.length - MAX_CHARS).toLocaleString("en-US")} over the limit`}
            </p>
            <button
              type="button"
              onClick={() => setText(townSample.text)}
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
            {checking && (
              <button type="button" onClick={stop} className={`${tertiaryCta} h-10`}>
                Stop
              </button>
            )}
            {tooShort && !tooLong && text.length > 0 && <span className="pb-2.5 text-xs text-muted">Paste at least {MIN_CHARS} characters.</span>}
            {tooLong && (
              <span className="pb-2.5 text-xs font-medium text-amber">
                Trim {(text.length - MAX_CHARS).toLocaleString("en-US")} characters to check this draft.
              </span>
            )}
          </div>

          <p id="plan-disclosure" className="mt-4 border-t border-hairline pt-3 text-xs leading-relaxed text-muted">
            Your text is sent to OpenAI to split it into items. Organisation names are looked up on OpenStreetMap, and the town&apos;s coordinates and
            the venue names your plan mentions are looked up in Qloo. Your plan text is never stored or sent to Qloo.
          </p>
        </form>

        <div aria-live="polite" className="empty:hidden">
          {checking && (
            <div role="status" className="mt-4 rounded-md border border-rule bg-concrete/60 px-4 py-3 text-sm">
              {/* Every stage is listed so the reader can see what is left. The stages are paced by time,
                  not reported by the server, so earlier ones are muted rather than ticked off. */}
              <ol className="space-y-1">
                {PROGRESS.map((line, i) => (
                  <li key={line} aria-current={i === step ? "step" : undefined} className={`flex items-start gap-3 ${i === step ? "font-medium text-ink" : "text-muted"}`}>
                    <span
                      aria-hidden
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${i === step ? "animate-pulse bg-contour motion-reduce:animate-none" : i < step ? "bg-rule" : "border border-rule"}`}
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-xs text-muted">
                <span className="sr-only">Stage {step + 1} of {PROGRESS.length}. </span>
                Usually 15–30 seconds<span className="font-mono tabular-nums"> · {elapsed} s</span>
              </p>
            </div>
          )}
          {view === "error" && (
            <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-amber/35 bg-amber-wash px-4 py-3 text-sm">
              <Notice className="h-4 w-4 text-amber" />
              <span className="min-w-0 flex-1">
                {error}
                {httpStatus > 0 && <span className="text-muted"> (server error {httpStatus})</span>} Your draft is still here.
              </span>
              <button type="button" onClick={() => void check()} className={secondaryCta}>
                Try again
              </button>
            </div>
          )}
          {view === "limited" && (
            <div role="alert" className="mt-4 flex gap-3 rounded-md border border-amber/35 bg-amber-wash px-4 py-3 text-sm">
              <Notice className="mt-0.5 h-4 w-4 text-amber" />
              <span>
                <span className="font-semibold">Limit reached.</span> {error} Your draft is still here.
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
