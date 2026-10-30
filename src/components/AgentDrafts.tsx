"use client";

import { useState } from "react";
import { Download, Notice } from "@/components/dashboard/Icons";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { ExternalLink } from "@/components/integrations/SessionCalendarLinks";
import { gmailComposeUrl, outlookComposeUrl } from "@/lib/integrations";

import type { AgentDraft, TraceStep } from "@/lib/agent";

interface AgentResult {
  model: string;
  sponsor?: string;
  sponsorSource?: "reported" | "entered" | "placeholder";
  signature?: string;
  companyHref?: string;
  summary: string;
  drafts: AgentDraft[];
  rejected?: { partner: string; reason: string }[];
  bucketNote?: string;
  trace: TraceStep[];
  steps: number;
  error?: string;
}

const emlHref = (d: AgentDraft) =>
  `data:message/rfc822;charset=utf-8,${encodeURIComponent(`Subject: ${d.subject.replace(/[\r\n]+/g, " ")}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${d.body}`)}`;

const TASTE_LABEL: Record<string, string> = { brand: "brands", artist: "artists", tv_show: "TV", podcast: "podcasts" };

// Plain-language activity log in place of raw tool names.
function describe(t: TraceStep): { text: string; ok: boolean } {
  const input = t.input && typeof t.input === "object" ? (t.input as Record<string, unknown>) : {};
  const name = typeof input.name === "string" ? input.name : undefined;
  switch (t.tool) {
    case "get_program":
      return { text: "Read the decided program", ok: true };
    case "local_places":
      return { text: `Looked up ${t.resultSize} local places in Qloo`, ok: true };
    case "local_taste": {
      const kind = TASTE_LABEL[String(input.type)] ?? "taste";
      return { text: t.resultSize ? `Read the town's local ${kind}${t.detail ? `: ${t.detail}` : ""}` : `Read the town's local ${kind} (none distinct)`, ok: true };
    }
    case "check_partner":
      if (t.by === "code")
        return t.found
          ? { text: `Code confirmed ${name ?? "a partner"} in OpenStreetMap after the agent skipped the check${t.detail ? ` (${t.detail})` : ""}`, ok: true }
          : { text: `The agent drafted to ${name ?? "a partner"} without checking; code couldn't confirm it independently (${t.detail ?? "not found"})`, ok: false };
      return t.found
        ? { text: `Confirmed ${name ?? "a partner"} independently in OpenStreetMap${t.detail ? ` (${t.detail})` : ""}`, ok: true }
        : { text: `Couldn't confirm ${name ?? "a partner"} independently${t.detail ? ` (${t.detail.toLowerCase()})` : " (not in OpenStreetMap within 25 km)"}`, ok: false };
    default:
      return { text: name ? `Checked ${name}` : "Checked the program", ok: true };
  }
}

// Every check a draft went through, in plain words. Passed ones sit behind one status; a failed one
// (such as a local signal that couldn't be verified) stays on the page in the warning tone.
function draftChecks(d: AgentDraft, sponsor: string): { ok: boolean; text: string }[] {
  const out: { ok: boolean; text: string }[] = [];
  if (d.rules) {
    out.push(
      { ok: d.rules.sponsorInBody, text: `Names ${sponsor} in the email` },
      { ok: d.rules.sponsorInSignature, text: `Signed for ${sponsor}` },
      { ok: !d.rules.topic, text: d.rules.topic ? `Mentioned ${d.rules.topic}` : "No land-use, vote, political or religious topics" },
      { ok: d.rules.inProgram, text: "Partner is in the program" },
    );
  }
  if (d.independent?.found) {
    out.push({
      ok: true,
      text: `Confirmed independently in OpenStreetMap${d.independent.osmName ? `: ${d.independent.osmName}` : ""}${d.independent.km != null ? `, ${d.independent.km} km from the site` : ""}${d.independent.by === "code" ? " (checked by code; the agent skipped it)" : ""}`,
    });
  }
  if (d.rules && d.checked === "passed" && d.localSignal) {
    out.push({ ok: !!d.signalVerified, text: d.signalVerified ? `Local signal: ${d.localSignal}` : `Local signal not verified: ${d.localSignal}` });
  }
  return out;
}

export function AgentDrafts({ slug, fund }: { slug: string; fund: number }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<AgentResult | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  async function run() {
    setState("loading");
    setErrorText(null);
    try {
      const res = await fetch(`/api/agent/${slug}?fund=${fund}`, { method: "POST" });
      const data: AgentResult = await res.json();
      // A rate limit (429) or an early return with no drafts carries a message worth showing as-is.
      if (!res.ok || (data.error && !data.drafts?.length)) {
        setResult(null);
        setErrorText(data.error ?? null);
        setState("error");
        return;
      }
      setResult(data);
      setState("done");
    } catch {
      setResult(null);
      setState("error");
    }
  }

  const activity = Array.from(new Map((result?.trace ?? []).map(describe).map((a) => [a.text, a])).values());
  const sponsor = result?.sponsor ?? "the sponsor";

  return (
    <section data-testid="agent-drafts" aria-busy={state === "loading"} className="no-print mt-10 scroll-mt-24 rounded-lg border border-rule bg-paper">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5 sm:px-6">
        <div className="max-w-xl">
          <p className="text-[13px] font-semibold text-muted">Next step</p>
          <h2 className="mt-1 font-semibold tracking-tight">Partner outreach</h2>
          <p className="mt-1 text-sm text-muted">
            An OpenAI agent picks partners from the program, confirms each one in OpenStreetMap and drafts a first email. Rules check every draft,
            including that it names the sponsor. Nothing is sent.
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
            <p className="text-sm text-muted">Reading the program, choosing partners and checking each one in OpenStreetMap. This takes about 20 to 40 seconds.</p>
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
            <Notice className="mt-0.5 h-4 w-4 text-amber" />
            <p>
              <span className="font-medium">{errorText ?? "The drafting agent is unavailable right now."}</span>{" "}
              <span className="text-muted">The program, the partner sheet and the calendar still work.{errorText ? "" : " Try again in a moment."}</span>
            </p>
          </div>
        )}

        {state === "done" && result && (
          <div className="border-t border-hairline">
            {result.sponsorSource === "placeholder" ? (
              <div role="note" className="flex gap-3 border-b border-amber/30 bg-amber-wash px-5 py-3 text-sm sm:px-6">
                <Notice className="mt-0.5 h-4 w-4 text-amber" />
                <p>
                  <span className="font-semibold">These drafts are signed &ldquo;{sponsor}&rdquo;.</span> Every message must name the company that funds the
                  program.{" "}
                  {result.companyHref && (
                    <a href={result.companyHref} className="underline underline-offset-4">
                      Add your company
                    </a>
                  )}{" "}
                  and redraft, or replace the placeholder before sending.
                </p>
              </div>
            ) : (
              result.signature && (
                <p className="border-b border-hairline px-5 py-3 text-xs text-muted sm:px-6">
                  Every draft names the sponsor, <span className="font-medium text-ink">{sponsor}</span>, and is signed &ldquo;{result.signature}&rdquo;.
                </p>
              )
            )}
            <div className="grid gap-6 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <p className="text-sm leading-relaxed">{result.summary}</p>
              {activity.length > 0 && (
                <div>
                  <p className="text-[13px] font-semibold">What the agent checked</p>
                  <ol className="mt-2 space-y-1.5 text-xs text-muted" aria-label="What the agent checked">
                    {activity.map((a, i) => (
                      <li key={a.text} className={`grid grid-cols-[1.25rem_1fr] ${a.ok ? "" : "text-amber"}`}>
                        {a.ok ? <span className="font-mono tabular-nums">{i + 1}</span> : <Notice className="mt-0.5 h-3 w-3 shrink-0 text-amber" />}
                        <span>{a.text}</span>
                      </li>
                    ))}
                  </ol>
                  {(result.rejected?.length ?? 0) > 0 && (
                    <>
                      <p className="mt-4 text-[13px] font-semibold">Dropped</p>
                      <ul className="mt-2 space-y-1.5 text-xs text-amber" aria-label="Partners the agent dropped">
                        {result.rejected!.map((r) => (
                          <li key={r.partner} className="flex gap-2">
                            <Notice className="mt-0.5 h-3 w-3 shrink-0" />
                            <span>
                              <span className="font-medium">{r.partner}</span>: {r.reason}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {result.bucketNote && <p className="mt-3 text-xs text-amber">{result.bucketNote}</p>}
                </div>
              )}
            </div>
            {result.drafts?.length ? (
              <ul className="divide-y divide-hairline border-t border-hairline">
                {result.drafts.map((d, i) => {
                  const checks = draftChecks(d, sponsor);
                  const passed = checks.filter((c) => c.ok);
                  const failed = checks.filter((c) => !c.ok);
                  return (
                  <li key={i} className="px-5 py-5 sm:px-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-muted">
                          To {d.partner}
                          {d.bucket && <> · {d.bucket}</>}
                        </p>
                        <p className="mt-0.5 font-medium">{d.subject}</p>
                      </div>
                      {d.checked === "passed" ? (
                        <details className="rp-more rule-menu">
                          <summary aria-label={`Passed ${passed.length} ${passed.length === 1 ? "check" : "checks"}: show them`}>
                            <StatusPill tone="ok">
                              Passed {passed.length} {passed.length === 1 ? "check" : "checks"}
                            </StatusPill>
                          </summary>
                          <ul aria-label="Rule check" className="cal-menu-panel space-y-1.5 text-xs text-muted">
                            {passed.map((c) => (
                              <li key={c.text}>{c.text}</li>
                            ))}
                          </ul>
                        </details>
                      ) : (
                        <StatusPill tone="warn">Replaced by template</StatusPill>
                      )}
                    </div>
                    {d.reason && (
                      <p className="mt-2 text-sm">
                        <span className="text-muted">Why the agent chose it:</span> {d.reason}
                      </p>
                    )}
                    {d.independent && !d.independent.found && (
                        <p className="mt-1 flex gap-1.5 text-xs text-amber">
                          <Notice className="mt-0.5 h-3 w-3 shrink-0" />
                          Couldn&apos;t confirm {d.partner} independently
                          {d.independent.unavailable ? " (OpenStreetMap didn't answer)" : " (not in OpenStreetMap within 25 km)"}. Check the contact before
                          sending.
                        </p>
                      )}
                    {d.note && <p className="mt-1 text-xs text-amber">{d.note}</p>}
                    <pre className="mt-3 whitespace-pre-wrap rounded-md bg-concrete/60 p-4 font-sans text-sm leading-relaxed text-ink/90">{d.body}</pre>
                    {failed.map((c) => (
                      <p key={c.text} className="mt-2 flex gap-1.5 text-xs text-amber">
                        <Notice className="mt-0.5 h-3 w-3 shrink-0" />
                        {c.text}
                      </p>
                    ))}
                    {/* Compose links leave "to" empty: no partner email address is known. */}
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                      <a
                        href={emlHref(d)}
                        download={`${d.partner.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.eml`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-rule px-3 py-1.5 transition-colors duration-150 hover:border-ink active:bg-concrete"
                      >
                        <Download />
                        Download .eml
                      </a>
                      <ExternalLink href={gmailComposeUrl({ subject: d.subject, body: d.body })} text="Open in Gmail" context={`the draft to ${d.partner}`}>
                        Open in Gmail
                      </ExternalLink>
                      <ExternalLink href={outlookComposeUrl({ subject: d.subject, body: d.body })} text="Open in Outlook" context={`the draft to ${d.partner}`}>
                        Open in Outlook
                      </ExternalLink>
                    </div>
                  </li>
                  );
                })}
              </ul>
            ) : (
              <p className="border-t border-hairline px-6 py-6 text-sm text-muted">
                No drafts this time: the program has no partners to write to, or none could be confirmed. Try Redraft.
              </p>
            )}
            <p className="border-t border-hairline px-5 py-3 text-xs text-muted sm:px-6">
              Drafts only, written by an OpenAI model. You review and send each one yourself.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
