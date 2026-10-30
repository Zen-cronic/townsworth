"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./TownMap.css";
import { BUCKETS, type Bucket } from "@/lib/buckets";
import { defaultChoices, planState, type Choice, type MapData, type MapLeg, type MapLine } from "@/lib/mapData";
import { fullscreenKey, isTypingTarget, type FullMode } from "@/lib/mapFullscreen";

// The town page's main view: the plan drawn on a 3D map of the town (OpenStreetMap data), with a
// panel that lists the draft's lines. Each struck line with a local swap flips between the draft
// and the swap; the flows, the venues and the totals follow. Everything is computed here from the
// data the server already sent. The panel is the keyboard and screen-reader path; the map repeats it.

const Canvas = dynamic(() => import("./TownMapCanvas"), { ssr: false, loading: () => <div className="tm-canvas tm-canvas-wait" aria-hidden="true" /> });

const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const km = (d?: number) => (d == null ? undefined : `${d < 10 ? d.toFixed(1) : Math.round(d)} km`);

// The program areas a flow can belong to, in the page's chart order.
const AREAS: { bucket: Bucket; label: string }[] = [
  { bucket: "training", label: "Trades nights" },
  { bucket: "procurement", label: "Supplier days" },
  { bucket: "grants", label: "Grants" },
  { bucket: "events", label: "Events" },
];

const STATUS: Record<MapLine["status"], string> = { kept: "Kept", struck: "Not local", unsure: "Can't confirm" };

const kindOf = (title: string) => title.split(/ hosted at |: | at |, /)[0];

function scrollToLine(anchor: string) {
  const el = document.getElementById(anchor);
  if (!el) return;
  history.replaceState(null, "", `#${anchor}`);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  el.focus({ preventScroll: true });
}

function VenueCard({ data, venueKey, legs, style, onClose, onGo }: { data: MapData; venueKey: string; legs: MapLeg[]; style?: React.CSSProperties; onClose?: () => void; onGo?: (n: number) => void }) {
  const v = data.venues.find((x) => x.key === venueKey);
  if (!v) return null;
  const here = legs.filter((l) => l.venue === venueKey);
  const lines = [...new Set(here.map((l) => l.line).filter((n): n is number => n != null))];
  const rank = v.rank ? `#${v.rank} of ${data.placeCount} places locals favour` : v.kind === "kept" ? "Named in the draft, found in Qloo" : "Not ranked by Qloo";
  return (
    <div className={`tm-card is-${v.kind}`} style={style} role="group" aria-label={`${v.name}: plan items`}>
      <div className="tm-card-head">
        <p className="tm-card-name">{v.name}</p>
        {onClose && (
          <button type="button" className="tm-card-x" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
              <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
            </svg>
          </button>
        )}
      </div>
      <p className="tm-card-meta">
        <span className={`tm-rank is-${v.kind}`}>{rank}</span>
        {km(v.distanceKm) && <span>{km(v.distanceKm)} from the site</span>}
      </p>
      {here.length > 0 ? (
        <ul className="tm-card-items">
          {here.map((l) => (
            <li key={l.id}>
              <span className={`tm-sw is-${l.bucket}`} aria-hidden="true" />
              <span className="tm-card-item">
                <b>{l.amount ? kindOf(l.title) : "Kept from the draft"}</b>
                <span>
                  {[BUCKETS[l.bucket].label, l.amount ? money(l.amount) : undefined, l.cadence].filter(Boolean).join(" · ")}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="tm-card-none">Not in the plan as drafted.</p>
      )}
      {lines.length > 0 && (
        <div className="tm-card-actions">
          {lines.map((n) => (
            <button key={n} type="button" className="tm-btn" onClick={() => (onGo ? onGo(n) : scrollToLine(data.lines[n - 1]?.anchor ?? `line-${n}`))}>
              Go to line {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Legend({ inline }: { inline?: boolean }) {
  return (
          <div className={`tm-legend${inline ? " is-inline" : ""}`} aria-hidden="true">
            <span>
              <i className="tm-dot is-ranked" />
              Qloo-ranked place
            </span>
            <span>
              <i className="tm-dot is-kept" />
              Kept from the draft
            </span>
            <span>
              <i className="tm-dot is-unranked" />
              Not ranked
            </span>
            <span>
              <i className="tm-dot is-site" />
              Facility site
            </span>
          </div>
  );
}

// The card sits beside the venue, kept inside the map.
function cardPos(p: { x: number; y: number }, box: HTMLElement | null): React.CSSProperties {
  const w = box?.clientWidth ?? 800;
  const h = box?.clientHeight ?? 600;
  const cw = Math.min(300, w - 16);
  const left = p.x + 18 + cw > w - 8 ? Math.max(8, p.x - 18 - cw) : p.x + 18;
  return { left, top: Math.min(Math.max(8, p.y - 28), Math.max(8, h - 260)), width: cw };
}

export function TownMap({ data, townName }: { data: MapData; townName: string }) {
  const [choices, setChoices] = useState<Record<number, Choice>>(() => defaultChoices(data));
  const [hidden, setHidden] = useState<Set<Bucket>>(() => new Set());
  const [showPlaces, setShowPlaces] = useState(false);
  const [focus, setFocus] = useState<string>();
  const [hover, setHover] = useState<string>();
  const [point, setPoint] = useState<{ x: number; y: number }>();
  const [failed, setFailed] = useState(false);
  const [resetTick, setResetTick] = useState(0);
  const mapEl = useRef<HTMLDivElement>(null);

  const state = useMemo(() => planState(data, choices, hidden), [data, choices, hidden]);
  const swappable = data.lines.filter((l) => l.swap);
  const allSwapped = swappable.every((l) => choices[l.n] !== "drafted");
  const areas = AREAS.filter((a) => [...data.lines.flatMap((l) => [...l.legs, ...(l.swap ? [l.swap] : [])]), ...data.extras].some((l) => l.bucket === a.bucket));
  const shown = focus ?? hover;

  const flip = (n: number, c: Choice) => setChoices((prev) => ({ ...prev, [n]: c }));
  const setAll = (c: Choice) => setChoices(defaultChoices(data, c));
  const toggleArea = (b: Bucket) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b);
      else next.add(b);
      return next;
    });

  const lineVenue = (l: MapLine) => (l.swap && choices[l.n] !== "drafted" ? l.swap.venue : l.legs[0]?.venue);

  const onHover = useCallback((key: string | undefined, p?: { x: number; y: number }) => {
    setHover(key);
    if (p) setPoint(p);
  }, []);
  const onSelect = useCallback((key: string) => setFocus(key), []);
  const onPoint = useCallback((p?: { x: number; y: number }) => setPoint(p), []);
  const onFail = useCallback(() => setFailed(true), []);

  // Full screen covers the whole section, map and panel, so every control keeps working. It uses
  // the Fullscreen API where the browser has it, and a fixed overlay over the page where it doesn't
  // (iPhone Safari has no element full screen).
  const section = useRef<HTMLElement>(null);
  const fullBtn = useRef<HTMLButtonElement>(null);
  const [full, setFull] = useState<FullMode | null>(null);
  const fullRef = useRef(full);
  fullRef.current = full;
  const hovered = useRef(false);
  const [hint, setHint] = useState(false);
  const [goLine, setGoLine] = useState<number>();

  const enterFull = useCallback(async () => {
    const el = section.current as (HTMLElement & { webkitRequestFullscreen?: () => void }) | null;
    if (!el || fullRef.current) return;
    const doc = document as Document & { webkitFullscreenEnabled?: boolean };
    if (typeof el.requestFullscreen === "function" && document.fullscreenEnabled) {
      try {
        await el.requestFullscreen({ navigationUI: "hide" });
        return;
      } catch {
        // Refused (a policy or an embedding frame): use the overlay.
      }
    } else if (typeof el.webkitRequestFullscreen === "function" && doc.webkitFullscreenEnabled) {
      el.webkitRequestFullscreen();
      return;
    }
    setFull("overlay");
  }, []);

  const exitFull = useCallback(() => {
    const doc = document as Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
    if (fullRef.current === "native") {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => setFull(null));
      else if (doc.webkitFullscreenElement) doc.webkitExitFullscreen?.();
      else setFull(null);
    } else if (fullRef.current === "overlay") setFull(null);
  }, []);

  const toggleFull = useCallback(() => {
    if (fullRef.current) exitFull();
    else void enterFull();
  }, [enterFull, exitFull]);

  // The browser reports native full screen changes, including its own Esc.
  useEffect(() => {
    const onChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      const el = document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
      if (el && el === section.current) setFull("native");
      else if (fullRef.current === "native") setFull(null);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  // F toggles while the map has focus or the pointer; Esc exits the overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = section.current;
      if (!el) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      const engaged = hovered.current || (!!target && el.contains(target)) || el.contains(document.activeElement);
      const act = fullscreenKey({ key: e.key, ctrl: e.ctrlKey, meta: e.metaKey, alt: e.altKey, repeat: e.repeat, typing: isTypingTarget(target), engaged }, fullRef.current);
      if (!act) return;
      e.preventDefault();
      if (act === "exit") exitFull();
      else toggleFull();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [exitFull, toggleFull]);

  // On enter: show the exit hint for a few seconds. On exit: focus goes back to the button.
  const wasFull = useRef(false);
  useEffect(() => {
    if (full) {
      wasFull.current = true;
      setHint(true);
      const t = window.setTimeout(() => setHint(false), 3500);
      return () => window.clearTimeout(t);
    }
    if (wasFull.current) {
      wasFull.current = false;
      setHint(false);
      fullBtn.current?.focus({ preventScroll: true });
    }
  }, [full]);

  // The overlay locks the page behind it.
  useEffect(() => {
    if (full !== "overlay") return;
    const html = document.documentElement;
    const body = document.body;
    const prev = [html.style.overflow, body.style.overflow];
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev[0];
      body.style.overflow = prev[1];
    };
  }, [full]);

  // Focus stays inside the full screen view: Tab wraps, and focus that lands behind it comes back.
  useEffect(() => {
    if (!full) return;
    const onFocusIn = (e: FocusEvent) => {
      const el = section.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) fullBtn.current?.focus({ preventScroll: true });
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [full]);

  const trapTab = (e: React.KeyboardEvent) => {
    const el = section.current;
    if (!full || e.key !== "Tab" || !el) return;
    const items = [...el.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])')].filter((x) => x.getClientRects().length > 0);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // In full screen, "Go to line" goes to the line in the panel; the page's line list is hidden.
  const goToPanelLine = useCallback((n: number) => {
    const row = section.current?.querySelector<HTMLElement>(`.tm-line[data-line="${n}"]`);
    if (!row) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let box: HTMLElement | null = row.parentElement;
    while (box && box !== section.current && !(box.scrollHeight > box.clientHeight && /auto|scroll/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
    if (box && box !== section.current) {
      const top = row.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 8;
      box.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
    }
    (row.querySelector<HTMLElement>(".tm-line-go") ?? row).focus({ preventScroll: true });
    setGoLine(n);
  }, []);
  useEffect(() => {
    if (goLine == null) return;
    const t = window.setTimeout(() => setGoLine(undefined), 1800);
    return () => window.clearTimeout(t);
  }, [goLine]);

  return (
    <section
      ref={section}
      aria-labelledby="map-title"
      className={`tm ui-section no-print${full ? " is-full" : ""}${full === "overlay" ? " is-overlay" : ""}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setFocus(undefined);
          setHover(undefined);
        }
        trapTab(e);
      }}
      onPointerEnter={() => (hovered.current = true)}
      onPointerLeave={() => (hovered.current = false)}
    >
      <div className="tm-frame">
        <div ref={mapEl} className="tm-map" role="region" aria-label={`Map of ${townName}: the facility site, the ${data.radiusKm} km Qloo search radius and each program venue. The panel lists the same plan.`}>
          {failed ? (
            <div className="tm-canvas tm-canvas-fail">
              <p>The map couldn&apos;t load in this browser. The plan is listed beside it and line by line below.</p>
            </div>
          ) : (
            <Canvas
              data={data}
              legs={state.visible}
              venues={state.venues}
              showPlaces={showPlaces}
              focus={focus}
              hover={hover}
              resetTick={resetTick}
              full={!!full}
              onHover={onHover}
              onSelect={onSelect}
              onPoint={onPoint}
              onFail={onFail}
            />
          )}
          {shown && point && !failed && (
            <VenueCard
              data={data}
              venueKey={shown}
              legs={state.visible}
              onClose={focus ? () => setFocus(undefined) : undefined}
              onGo={full ? goToPanelLine : undefined}
              style={cardPos(point, mapEl.current)}
            />
          )}
          <Legend />
          {data.venues.length === 0 && !failed && (
            <p className="tm-empty">No venue in this plan has a Qloo map position here. The lines are listed beside the map.</p>
          )}
          {!failed && (
            <div className="tm-tools">
              <button type="button" className="tm-btn tm-reset" onClick={() => (setFocus(undefined), setResetTick((t) => t + 1))}>
                Reset view
              </button>
              <button
                ref={fullBtn}
                type="button"
                className="tm-btn tm-full"
                aria-pressed={!!full}
                aria-label={full ? "Exit full screen" : "Full screen"}
                aria-keyshortcuts="F"
                title={full ? "Exit full screen (Esc or F)" : "Full screen (F)"}
                onClick={toggleFull}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  {full ? <path d="M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4" /> : <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" />}
                </svg>
                <span>{full ? "Exit full screen" : "Full screen"}</span>
              </button>
            </div>
          )}
          {full && (
            <p className={`tm-hint${hint ? "" : " is-gone"}`} role="status">
              Press <kbd>Esc</kbd> or <kbd>F</kbd> to exit
            </p>
          )}
        </div>

        <div className="tm-panel">
          <Legend inline />
          <div className="tm-panel-head">
            <h2 id="map-title" className="tm-title">
              The plan on the map
            </h2>
            <p className="tm-lede">Flip a struck line to its local swap and the flows redraw.</p>
            <div className="tm-totals" aria-live="polite">
              <p className="tm-total">
                <b>
                  {state.localLines} of {state.totalLines}
                </b>
                <span>lines local</span>
              </p>
              <p className="tm-total">
                <b>{money(state.total)}</b>
                <span>local program, 24 months</span>
              </p>
            </div>
            {swappable.length > 0 && (
              <button type="button" className="tm-primary" onClick={() => setAll(allSwapped ? "drafted" : "swap")}>
                {allSwapped ? "Show the draft as written" : `Apply all ${swappable.length} swaps`}
              </button>
            )}
            {areas.length > 1 && (
              <div className="tm-areas" role="group" aria-label="Show flows by program area">
                {areas.map((a) => (
                  <button key={a.bucket} type="button" className="tm-area" aria-pressed={!hidden.has(a.bucket)} onClick={() => toggleArea(a.bucket)}>
                    <span className={`tm-sw is-${a.bucket}`} aria-hidden="true" />
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <ol className="tm-lines" aria-label="The draft's lines">
            {data.lines.map((l) => {
              const swapped = !!l.swap && choices[l.n] !== "drafted";
              const venue = lineVenue(l);
              const status = swapped ? "swap" : l.status;
              return (
                <li key={l.n} data-line={l.n} tabIndex={-1} className={`tm-line is-${status}${venue && venue === shown ? " is-hot" : ""}${goLine === l.n ? " is-go" : ""}`}>
                  <span className="tm-line-n">{l.n}</span>
                  <div className="tm-line-body">
                    {venue ? (
                      <button
                        type="button"
                        className="tm-line-go"
                        onClick={() => setFocus(venue)}
                        onMouseEnter={() => setHover(venue)}
                        onMouseLeave={() => setHover(undefined)}
                        aria-label={`Line ${l.n}: ${l.text}. Show ${data.venues.find((v) => v.key === venue)?.name ?? "the venue"} on the map`}
                      >
                        <span className={`tm-line-text${swapped || l.status !== "kept" ? " is-struck" : ""}`}>{l.text}</span>
                      </button>
                    ) : (
                      <span className={`tm-line-text${l.status !== "kept" ? " is-struck" : ""}`}>{l.text}</span>
                    )}
                    <p className="tm-line-meta">
                      <span className={`tm-status is-${status}`}>{swapped ? "Swapped" : STATUS[l.status]}</span>
                      {swapped && l.swap ? (
                        <span>
                          {data.venues.find((v) => v.key === l.swap!.venue)?.name} · {money(l.swap.amount)}
                        </span>
                      ) : l.venueName && l.status === "kept" ? (
                        <span>{l.venueName}</span>
                      ) : l.status !== "kept" && !l.swap ? (
                        <span>No local swap</span>
                      ) : null}
                    </p>
                    {l.swap && (
                      <div className="tm-seg" role="group" aria-label={`Line ${l.n}`}>
                        <button type="button" aria-pressed={!swapped} onClick={() => flip(l.n, "drafted")}>
                          As drafted
                        </button>
                        <button type="button" aria-pressed={swapped} onClick={() => flip(l.n, "swap")}>
                          Townsworth&apos;s swap
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="tm-panel-foot">
            <label className="tm-check">
              <input type="checkbox" checked={showPlaces} onChange={(e) => setShowPlaces(e.target.checked)} />
              Show all {data.places.length} Qloo places
            </label>
            {data.unplaced.length > 0 && (
              <details className="tm-unplaced">
                <summary>
                  {data.unplaced.length} {data.unplaced.length === 1 ? "partner" : "partners"} with no map position
                </summary>
                <ul>
                  {data.unplaced.map((u) => (
                    <li key={u.name}>
                      <b>{u.name}</b> {[u.source === "OpenStreetMap" ? "OpenStreetMap match" : "Qloo, no coordinates", km(u.distanceKm), u.line ? `line ${u.line}` : undefined].filter(Boolean).join(" · ")}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
