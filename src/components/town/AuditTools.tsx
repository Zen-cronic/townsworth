"use client";

import { useCallback, useEffect, useState } from "react";
import { tertiaryCta } from "@/components/dashboard/ui";

type Filter = "all" | "struck" | "kept";

// Controls above the line-by-line check: show every line, only struck or only kept lines; step
// through the struck lines one at a time; lift the two-line clamp on every line. Rows stay in the
// server-rendered list (#audit-lines); this only sets data attributes on it, so every #line-N
// anchor keeps working, and a jump to a hidden line shows all lines first.
export function AuditTools({ counts, struckIds }: { counts: { all: number; struck: number; kept: number }; struckIds: string[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [full, setFull] = useState(false);
  const [at, setAt] = useState(-1);

  const list = () => document.getElementById("audit-lines");

  useEffect(() => {
    const el = list();
    if (!el) return;
    if (filter === "all") el.removeAttribute("data-filter");
    else el.setAttribute("data-filter", filter);
  }, [filter]);

  useEffect(() => {
    const el = list();
    if (!el) return;
    if (full) el.setAttribute("data-full", "");
    else el.removeAttribute("data-full");
  }, [full]);

  // A #line-N jump (from a tile, the stepper or a shared link) always lands on a visible row.
  useEffect(() => {
    const onHash = () => {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (!target || !list()?.contains(target)) return;
      if (target.offsetParent === null) {
        setFilter("all");
        requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
      }
      const i = struckIds.indexOf(target.id);
      if (i >= 0) setAt(i);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [struckIds]);

  const go = useCallback(
    (delta: 1 | -1) => {
      if (!struckIds.length) return;
      if (filter === "kept") setFilter("all");
      // From the current reading position when nothing has been stepped to yet.
      let next = at + delta;
      if (at < 0) {
        const line = (document.querySelector<HTMLElement>("[data-app-header]")?.offsetHeight ?? 0) + 24;
        const below = struckIds.findIndex((id) => (document.getElementById(id)?.getBoundingClientRect().top ?? 0) > line);
        next = delta > 0 ? (below < 0 ? struckIds.length - 1 : below) : below <= 0 ? 0 : below - 1;
      }
      next = Math.max(0, Math.min(struckIds.length - 1, next));
      setAt(next);
      const id = struckIds[next];
      requestAnimationFrame(() => {
        if (location.hash === `#${id}`) document.getElementById(id)?.scrollIntoView({ block: "start" });
        else location.hash = id;
        document.getElementById(id)?.focus({ preventScroll: true });
      });
    },
    [at, filter, struckIds],
  );

  const option = (f: Filter, label: string, n: number) => (
    <button
      key={f}
      type="button"
      aria-pressed={filter === f}
      disabled={n === 0 && f !== "all"}
      onClick={() => setFilter(f)}
      className={`rounded px-2.5 py-1 transition-colors duration-150 disabled:cursor-not-allowed disabled:text-rule ${
        filter === f ? "bg-paper font-medium text-ink shadow-sm" : "text-muted hover:text-ink active:bg-hairline"
      }`}
    >
      {label} <span className="tabular-nums">{n}</span>
    </button>
  );

  return (
    <div className="no-print flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-hairline px-5 py-2.5 text-sm sm:px-6">
      <div role="group" aria-label="Show lines" className="flex rounded-md bg-concrete p-0.5 shadow-[inset_0_0_0_1px_var(--hairline)]">
        {option("all", "All", counts.all)}
        {option("struck", "Struck", counts.struck)}
        {option("kept", "Kept", counts.kept)}
      </div>
      {struckIds.length > 0 && (
        <div role="group" aria-label="Step through struck lines" className="flex items-center gap-1">
          <button type="button" onClick={() => go(-1)} disabled={at === 0} className={`${tertiaryCta} disabled:cursor-not-allowed disabled:text-muted`}>
            Previous struck
          </button>
          <span aria-hidden className="text-muted">
            ·
          </span>
          <button type="button" onClick={() => go(1)} disabled={at === struckIds.length - 1} className={`${tertiaryCta} disabled:cursor-not-allowed disabled:text-muted`}>
            Next struck line
          </button>
          <span aria-live="polite" className="ml-1 text-xs tabular-nums text-muted">
            {at >= 0 ? `${at + 1} of ${struckIds.length}` : ""}
          </span>
        </div>
      )}
      <button type="button" aria-pressed={full} onClick={() => setFull((v) => !v)} className={`${tertiaryCta} ml-auto`}>
        {full ? "Clamp long lines" : "Show all lines in full"}
      </button>
    </div>
  );
}
