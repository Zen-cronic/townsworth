"use client";

import { useCallback, useEffect, useState } from "react";
import "./AuditTools.css";
import { tertiaryCta } from "@/components/dashboard/ui";

type Filter = "all" | "generic" | "unsure" | "kept";

// Controls above the line-by-line check, on one row: show every line or only one verdict (each
// option carries its verdict's gutter mark, so the row doubles as the legend); step through the
// struck lines one at a time; lift the two-line clamp on every line. Rows stay in the
// server-rendered list (#audit-lines); this only sets data attributes on it, so every #line-N
// anchor keeps working, and a jump to a hidden line shows all lines first.
export function AuditTools({
  counts,
  struckIds,
  children,
}: {
  counts: { all: number; generic: number; unsure: number; kept: number };
  struckIds: string[];
  // The verdict definitions, shown beside the options.
  children?: React.ReactNode;
}) {
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

  // A #line-N jump (from a tile, the stepper or a shared link) always lands on a visible row, in
  // view and marked. The rows stream in after the page shell, so a link opened from elsewhere
  // arrives before its row exists and the browser's own jump misses it: the first run below
  // (on mount) makes that jump, and repeats it once late layout (fonts, the charts) has settled.
  useEffect(() => {
    const land = (scroll: boolean) => {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (!target || !list()?.contains(target)) return;
      document.querySelectorAll(".audit-row.is-landed").forEach((el) => el !== target && el.classList.remove("is-landed"));
      target.classList.add("is-landed");
      const hidden = target.offsetParent === null;
      if (hidden) setFilter("all");
      if (scroll || hidden) requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
      const i = struckIds.indexOf(target.id);
      if (i >= 0) setAt(i);
    };
    land(true);
    const settle = window.setTimeout(() => {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      const top = target?.getBoundingClientRect().top;
      if (top != null && (top < 0 || top > window.innerHeight * 0.6)) target!.scrollIntoView({ block: "start" });
    }, 700);
    const onHash = () => land(false);
    window.addEventListener("hashchange", onHash);
    return () => {
      window.clearTimeout(settle);
      window.removeEventListener("hashchange", onHash);
    };
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

  const option = (f: Filter, label: string, n: number, mark?: string) => (
    <button
      key={f}
      type="button"
      aria-pressed={filter === f}
      disabled={n === 0 && f !== "all"}
      onClick={() => setFilter(f)}
      className="audit-opt"
    >
      {mark && <span aria-hidden className={`audit-mark ${mark}`} />}
      {label} <span className="tabular-nums">{n}</span>
    </button>
  );

  return (
    <div className="audit-bar no-print">
      <div role="group" aria-label="Show lines" className="audit-filter">
        {option("all", "All", counts.all)}
        {option("generic", "Not local", counts.generic, "is-generic")}
        {option("unsure", "Can't confirm", counts.unsure, "is-unsure")}
        {option("kept", "Kept", counts.kept, "is-kept")}
      </div>
      {children}
      <div className="audit-bar-end">
        {struckIds.length > 0 && (
          <div role="group" aria-label="Step through struck lines" className="audit-stepper">
            <button type="button" onClick={() => go(-1)} disabled={at === 0} aria-label="Previous struck line" className="audit-step">
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="M10 3.5 5.5 8l4.5 4.5" />
              </svg>
            </button>
            <span aria-live="polite" className="audit-step-n">
              {at >= 0 ? `Stop ${at + 1} of ${struckIds.length}` : `${struckIds.length} ${struckIds.length === 1 ? "stop" : "stops"}`}
            </span>
            <button type="button" onClick={() => go(1)} disabled={at === struckIds.length - 1} aria-label="Next struck line" className="audit-step">
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="M6 3.5 10.5 8 6 12.5" />
              </svg>
            </button>
          </div>
        )}
        <button type="button" aria-pressed={full} onClick={() => setFull((v) => !v)} className={tertiaryCta}>
          {full ? "Clamp long lines" : "Show all"}
        </button>
      </div>
    </div>
  );
}
