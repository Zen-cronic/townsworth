"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Download } from "@/components/dashboard/Icons";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { primaryCta, secondaryCta } from "@/components/dashboard/ui";
import {
  ballotKey,
  borda,
  isValidBallot,
  simulateBallots,
  SIMULATED_BALLOTS,
  tallyCsv,
  type BallotItem,
  type StoredBallot,
} from "@/lib/ballot";
import { DistanceLine } from "./ItemMeta";

type Mine = { state: "unknown" } | { state: "none" } | { state: "stale" } | { state: "counted"; ballot: StoredBallot };

const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;

// One blue ramp, darkest = ranked first: a mix of the field blue into paper. Pink stays the strike.
const shade = (r: number, n: number) => Math.round(n <= 1 ? 100 : 100 - (r / (n - 1)) * 70);
const fill = (r: number, n: number) => `color-mix(in srgb, var(--band) ${shade(r, n)}%, var(--paper))`;

function RankBar({ counts, total, label }: { counts: number[]; total: number; label: string }) {
  const n = counts.length;
  return (
    <div className="ch-anim w-full">
      <div role="img" aria-label={label} className="ch-reveal flex h-3.5 w-full gap-[2px] overflow-hidden rounded-[4px] bg-paper shadow-[inset_0_0_0_1px_var(--hairline)]">
        {counts.map((c, r) =>
          c > 0 ? <span key={r} className="ch-ramp h-full" style={{ width: `${(c / total) * 100}%`, background: fill(r, n) }} /> : null,
        )}
      </div>
    </div>
  );
}

export function BallotResults({ slug, townName, items }: { slug: string; townName: string; items: BallotItem[] }) {
  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const simulated = useMemo(() => simulateBallots(slug, ids), [slug, ids]);
  const [mine, setMine] = useState<Mine>({ state: "unknown" });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ballotKey(slug));
      if (!raw) {
        setMine({ state: "none" });
        return;
      }
      const saved = JSON.parse(raw) as StoredBallot;
      setMine(isValidBallot(saved?.ids, ids) ? { state: "counted", ballot: saved } : { state: "stale" });
    } catch {
      setMine({ state: "none" });
    }
  }, [slug, ids]);

  const counted = mine.state === "counted";
  const tally = useMemo(
    () => borda(items, counted ? [...simulated, { ids: mine.ballot.ids }] : simulated),
    [items, simulated, counted, mine],
  );
  const n = items.length;
  const myRank = counted ? new Map(mine.ballot.ids.map((id, r) => [id, r + 1])) : null;
  const basis = `Simulated: ${SIMULATED_BALLOTS} random sample ballots, not real residents${counted ? ", plus 1 ballot from this browser" : ""}`;

  function downloadCsv() {
    const blob = new Blob([tallyCsv(tally, basis)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `good-neighbor-ballot-${slug}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function clearMine() {
    try {
      window.localStorage.removeItem(ballotKey(slug));
    } catch {
      // Nothing stored or storage blocked; either way nothing leaves the browser.
    }
    setMine({ state: "none" });
  }

  return (
    <>
      {/* Simulation label */}
      <div id="simulated" className="mt-6 scroll-mt-24 rounded-md border border-amber/40 bg-amber-wash px-4 py-3.5 sm:px-5" data-testid="simulated-label">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone="warn">Simulated</StatusPill>
          {counted && <StatusPill tone="ok">Includes your ballot</StatusPill>}
        </div>
        <p className="mt-2 text-[15px] font-medium leading-relaxed">
          Simulated: {SIMULATED_BALLOTS} random sample ballots, generated to show the tally. They are not real residents and predict nothing.
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted" aria-live="polite">
          {mine.state === "counted" && <>Includes your ballot. {tally.ballots} ballots counted in total.</>}
          {mine.state === "none" && (
            <>
              You haven&apos;t ranked the shortlist in this browser.{" "}
              <Link href={`/ballot/${slug}`} className="font-medium text-ink underline underline-offset-2">
                Add your ballot
              </Link>
            </>
          )}
          {mine.state === "stale" && (
            <>
              Your saved ballot was for an earlier shortlist, so it isn&apos;t counted.{" "}
              <Link href={`/ballot/${slug}`} className="font-medium text-ink underline underline-offset-2">
                Rank the current one
              </Link>
            </>
          )}
          {mine.state === "unknown" && <>&nbsp;</>}
        </p>
      </div>

      {/* Method */}
      <p className="mt-5 text-sm leading-relaxed text-muted">
        <strong className="font-semibold text-ink">Method: points ranking (Borda count).</strong> On a ballot of {n} ideas, 1st place earns {n - 1} points and
        last earns 0. The bar shows how often each idea was ranked in each position, darkest = 1st.
      </p>

      {/* Tally */}
      <ol className="mt-4 divide-y divide-hairline border-y border-rule" data-testid="tally">
        {tally.rows.map((row, i) => {
          const share = Math.round(row.firstShare * 100);
          const label = row.rankCounts.map((c, r) => `${ordinal(r + 1)}: ${c}`).join(", ");
          return (
            <li key={row.item.id} className={`row-edge ${i === 0 ? "is-kept bg-side" : "is-quiet"} grid grid-cols-[1.75rem_1fr] gap-x-3 px-3 py-4`}>
              <span className={`pt-0.5 text-right font-mono text-lg font-medium tabular-nums leading-6 ${i === 0 ? "text-ink" : ""}`}>{i + 1}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="min-w-0 text-[15px] font-semibold leading-snug sm:text-base">{row.item.title}</h3>
                  <span className="font-mono text-sm tabular-nums">
                    {row.points.toLocaleString("en-US")} <span className="text-xs text-muted">pts</span>
                  </span>
                </div>
                <DistanceLine item={row.item} townName={townName} />
                <div className="mt-2.5 flex items-center gap-3">
                  <RankBar counts={row.rankCounts} total={tally.ballots || 1} label={`Ranking positions across ${tally.ballots} ballots. ${label}`} />
                  <span className="w-[8.5rem] shrink-0 text-right text-xs text-muted">
                    <span className="font-mono tabular-nums text-ink">{share}%</span> first choice
                  </span>
                </div>
                {myRank && (
                  <p className="mt-1.5 text-xs text-muted">
                    You ranked it <span className="font-mono text-ink">{ordinal(myRank.get(row.item.id) ?? 0)}</span>
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <div aria-hidden className="mt-2 flex items-center justify-end gap-2 text-[11px] text-muted">
        1st
        <span className="flex h-2 w-24 overflow-hidden rounded-[2px]">
          {Array.from({ length: n }, (_, r) => (
            <span key={r} className="ch-ramp h-full flex-1" style={{ background: fill(r, n) }} />
          ))}
        </span>
        {ordinal(n)}
      </div>

      {counted && mine.ballot.missing && (
        <div className="mt-6 rounded-md border border-rule bg-paper px-4 py-3 text-sm">
          <p className="text-xs font-medium text-muted">Your &ldquo;something missing&rdquo; note (kept in this browser only)</p>
          <p className="mt-1 whitespace-pre-wrap break-words leading-relaxed">{mine.ballot.missing}</p>
        </div>
      )}

      {/* Decision */}
      <p className="mt-8 border-l border-ink pl-3 text-base font-semibold leading-snug">The community committee decides; the ranking informs it.</p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Link href={`/memo/${slug}`} className={`${primaryCta} min-h-11`}>
          Back to the memo
        </Link>
        <button type="button" onClick={downloadCsv} className={`${secondaryCta} min-h-11`}>
          <Download />
          Tally (CSV)
        </button>
        <Link href={`/ballot/${slug}`} className={`${secondaryCta} min-h-11`}>
          {counted ? "Change my ballot" : "Rank the shortlist"}
        </Link>
        {counted && (
          <button type="button" onClick={clearMine} className="min-h-11 rounded-md px-3 text-sm text-muted underline underline-offset-2 hover:text-ink">
            Remove my ballot from this browser
          </button>
        )}
      </div>
    </>
  );
}
