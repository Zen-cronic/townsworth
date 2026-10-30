"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Download } from "@/components/dashboard/Icons";
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
import { AreaLabel, DistanceLine } from "./ItemMeta";
import { BallotSplit } from "./BallotSplit";
import { isLast, ordinal, rankFill, rankInk } from "./rank";

type Mine = { state: "unknown" } | { state: "none" } | { state: "stale" } | { state: "counted"; ballot: StoredBallot };

function RankBar({ counts, total, label, mine }: { counts: number[]; total: number; label: string; mine?: number }) {
  const n = counts.length;
  const width = (c: number) => `${(c / total) * 100}%`;
  return (
    <div className="ch-anim w-full">
      <div role="img" aria-label={label} className="ch-reveal flex h-5 w-full gap-[2px] overflow-hidden rounded-[3px]">
        {counts.map((c, r) =>
          c > 0 ? (
            <span
              key={r}
              className={`ch-ramp bl-seg ${isLast(r, n) ? "is-outline" : ""}`}
              style={{ width: width(c), background: rankFill(r, n), color: rankInk(r, n) }}
            >
              {/* The position names itself when its segment has room. */}
              {c / total >= 0.12 && <span aria-hidden>{ordinal(r + 1)}</span>}
            </span>
          ) : null,
        )}
      </div>
      {mine != null && (
        // A notch under the segment for the position this browser's ballot gave the idea.
        <div aria-hidden className="mt-[3px] flex h-[3px] w-full gap-[2px]">
          {counts.map((c, r) => (c > 0 ? <span key={r} className={r === mine - 1 ? "bg-ink" : ""} style={{ width: width(c) }} /> : null))}
        </div>
      )}
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

  const side = (
    <>
      {/* Simulation label: a ruled notice, prominent, never a badge */}
      <div id="simulated" className="bl-sim scroll-mt-24" data-testid="simulated-label">
        <p className="bl-sim-k">Simulated</p>
        <p className="mt-1.5 text-[15px] font-semibold leading-relaxed">
          Simulated: {SIMULATED_BALLOTS} random sample ballots, generated to show the tally. They are not real residents and predict nothing.
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink" aria-live="polite">
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
      <p className="mt-6 text-sm leading-relaxed text-muted">
        <strong className="font-semibold text-ink">Method: points ranking (Borda count).</strong> On a ballot of {n} ideas, 1st place earns {n - 1} points and
        last earns 0. The bar shows how often each idea was ranked in each position, darkest = 1st.
      </p>

      {counted && mine.ballot.missing && (
        <div className="mt-6 border-t border-rule pt-4 text-sm">
          <p className="text-sm font-medium text-muted">Your &ldquo;something missing&rdquo; note (kept in this browser only)</p>
          <p className="mt-1 whitespace-pre-wrap break-words leading-relaxed">{mine.ballot.missing}</p>
        </div>
      )}

      {/* Decision */}
      <p className="mt-8 border-t border-ink pt-4 text-base font-semibold leading-snug">The community committee decides; the ranking informs it.</p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Link href={`/memo/${slug}`} className={`${primaryCta} bl-primary min-h-11`}>
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

  return (
    <BallotSplit side={side}>
      {/* Position key: each step of the bar, named */}
      <p aria-hidden className="bl-key">
        {Array.from({ length: n }, (_, r) => (
          <span key={r}>
            <span className={`bl-key-sw ${isLast(r, n) ? "is-outline" : ""}`} style={{ background: rankFill(r, n) }} />
            {ordinal(r + 1)}
          </span>
        ))}
      </p>

      {/* Tally */}
      <ol className="bl-rows mt-3" data-testid="tally">
        {tally.rows.map((row, i) => {
          const share = Math.round(row.firstShare * 100);
          const label = row.rankCounts.map((c, r) => `${ordinal(r + 1)}: ${c}`).join(", ");
          const mineAt = myRank?.get(row.item.id);
          return (
            <li key={row.item.id} className="bl-row grid grid-cols-[1.75rem_minmax(0,1fr)_6.5rem] gap-x-4 py-4 max-[600px]:grid-cols-[1.5rem_minmax(0,1fr)_5rem] max-[600px]:gap-x-3">
              <span className="bl-n text-right">{i + 1}</span>
              <div className="min-w-0">
                <AreaLabel item={row.item} />
                <h3 className="min-w-0 text-[15px] font-semibold leading-snug sm:text-base">{row.item.title}</h3>
                <DistanceLine item={row.item} townName={townName} />
                <div className="mt-3">
                  <RankBar
                    counts={row.rankCounts}
                    total={tally.ballots || 1}
                    mine={mineAt}
                    label={`Ranking positions across ${tally.ballots} ballots. ${label}`}
                  />
                </div>
                {mineAt != null && (
                  <p className="mt-2 text-sm font-semibold text-ink">
                    You ranked it {ordinal(mineAt)}
                  </p>
                )}
              </div>
              {/* Points and first-choice share, one right-aligned column */}
              <div className="text-right">
                <p className="text-base font-semibold tabular-nums">
                  {row.points.toLocaleString("en-US")} <span className="text-sm font-normal text-muted">pts</span>
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  <span className="font-semibold tabular-nums text-ink">{share}%</span> first choice
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </BallotSplit>
  );
}
