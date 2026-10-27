"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { primaryCta } from "@/components/dashboard/ui";
import { ballotKey, isValidBallot, type BallotItem, type StoredBallot } from "@/lib/ballot";
import { DistanceLine } from "./ItemMeta";

function Arrow({ dir }: { dir: "up" | "down" }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4">
      <path d={dir === "up" ? "M8 12.5v-9M4 7.5l4-4 4 4" : "M8 3.5v9M4 8.5l4 4 4-4"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const moveButton =
  "grid h-11 w-11 place-items-center rounded-md border border-rule bg-paper text-ink transition-colors duration-150 hover:border-ink active:bg-concrete disabled:cursor-not-allowed disabled:border-hairline disabled:text-rule disabled:hover:border-hairline";

export function BallotForm({ slug, townName, items }: { slug: string; townName: string; items: BallotItem[] }) {
  const router = useRouter();
  const [order, setOrder] = useState(() => items.map((i) => i.id));
  const [missing, setMissing] = useState("");
  const [status, setStatus] = useState("");
  const [saveError, setSaveError] = useState(false);
  const [pending, setPending] = useState(false);
  const focusNext = useRef<string | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement | null>());
  const byId = new Map(items.map((i) => [i.id, i]));

  // Pick up an earlier ballot from this browser so a resident can revise it.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ballotKey(slug));
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<StoredBallot>;
      if (isValidBallot(saved.ids, items.map((i) => i.id))) {
        setOrder(saved.ids);
        if (typeof saved.missing === "string") setMissing(saved.missing);
      }
    } catch {
      // Storage blocked or corrupt: start from the shortlist order.
    }
  }, [slug, items]);

  useEffect(() => {
    if (!focusNext.current) return;
    buttons.current.get(focusNext.current)?.focus();
    focusNext.current = null;
  });

  function move(from: number, delta: -1 | 1) {
    const to = from + delta;
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const [id] = next.splice(from, 1);
    next.splice(to, 0, id);
    setOrder(next);
    // Keep focus on the moved item; switch arrows when it reaches the top or bottom.
    const dir = to === 0 ? "down" : to === next.length - 1 ? "up" : delta < 0 ? "up" : "down";
    focusNext.current = `${id}:${dir}`;
    setStatus(`${byId.get(id)?.title ?? "Item"} moved to position ${to + 1} of ${next.length}.`);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const ballot: StoredBallot = { v: 1, ids: order, missing: missing.trim() || undefined, at: new Date().toISOString() };
    try {
      window.localStorage.setItem(ballotKey(slug), JSON.stringify(ballot));
    } catch {
      setSaveError(true);
      setPending(false);
      return;
    }
    router.push(`/ballot/${slug}/results`);
  }

  return (
    <form onSubmit={submit} className="mt-6">
      <p id="rank-help" className="text-sm text-muted">
        Use the arrows to move an idea up or down. Top means &ldquo;do this first.&rdquo;
      </p>
      <ol aria-describedby="rank-help" className="mt-3 space-y-2.5">
        {order.map((id, i) => {
          const it = byId.get(id);
          if (!it) return null;
          return (
            <li key={id} className="flex items-stretch gap-3 rounded-md border border-rule bg-paper p-3 sm:p-4">
              <span aria-hidden className="w-6 shrink-0 pt-0.5 text-right font-mono text-lg font-medium tabular-nums leading-6">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-semibold leading-snug sm:text-base">
                  <span className="sr-only">Position {i + 1}: </span>
                  {it.title}
                </h3>
                {it.note && <p className="mt-1 text-sm leading-relaxed text-muted">{it.note}</p>}
                <DistanceLine item={it} townName={townName} />
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                <button
                  type="button"
                  ref={(el) => {
                    buttons.current.set(`${id}:up`, el);
                  }}
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move up: ${it.title}`}
                  className={moveButton}
                >
                  <Arrow dir="up" />
                </button>
                <button
                  type="button"
                  ref={(el) => {
                    buttons.current.set(`${id}:down`, el);
                  }}
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1}
                  aria-label={`Move down: ${it.title}`}
                  className={moveButton}
                >
                  <Arrow dir="down" />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <p aria-live="polite" className="sr-only">
        {status}
      </p>

      <div className="mt-6">
        <label htmlFor="missing" className="block text-sm font-semibold">
          Something missing? <span className="font-normal text-muted">(optional)</span>
        </label>
        <p id="missing-help" className="mt-0.5 text-sm text-muted">
          An idea the committee should hear about. Please leave out names and contact details.
        </p>
        <textarea
          id="missing"
          aria-describedby="missing-help"
          value={missing}
          onChange={(e) => setMissing(e.target.value)}
          maxLength={500}
          rows={3}
          className="mt-2 w-full rounded-md border border-rule bg-paper px-3 py-2 text-[15px] leading-relaxed placeholder:text-muted/70 focus-visible:border-ink"
          placeholder="For example: a winter coat drive at the library"
        />
      </div>

      {saveError && (
        <p role="alert" className="mt-4 rounded-md border border-amber/30 bg-amber-wash px-3 py-2 text-sm">
          This browser blocked saving the ballot (private mode or storage turned off). Nothing was sent anywhere. Try again with storage allowed.
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
        <button type="submit" disabled={pending} className={`${primaryCta} min-h-11 px-5 disabled:opacity-70`}>
          {pending ? "Saving…" : "Submit my ranking"}
        </button>
        <span className="text-sm text-muted">Anonymous: no name, email or address is asked for.</span>
      </div>
    </form>
  );
}
