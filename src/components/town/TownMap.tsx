"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState } from "react";
import "./TownMap.css";
import { BUCKETS, type Bucket } from "@/lib/buckets";
import { defaultChoices, planState, type Choice, type MapData, type MapLeg, type MapLine } from "@/lib/mapData";

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

function VenueCard({ data, venueKey, legs, style, onClose }: { data: MapData; venueKey: string; legs: MapLeg[]; style?: React.CSSProperties; onClose?: () => void }) {
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
            <button key={n} type="button" className="tm-btn" onClick={() => scrollToLine(data.lines[n - 1]?.anchor ?? `line-${n}`)}>
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

  return (
    <section aria-labelledby="map-title" className="tm ui-section no-print" onKeyDown={(e) => e.key === "Escape" && (setFocus(undefined), setHover(undefined))}>
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
              style={cardPos(point, mapEl.current)}
            />
          )}
          <Legend />
          {data.venues.length === 0 && !failed && (
            <p className="tm-empty">No venue in this plan has a Qloo map position here. The lines are listed beside the map.</p>
          )}
          {!failed && (
            <button type="button" className="tm-btn tm-reset" onClick={() => (setFocus(undefined), setResetTick((t) => t + 1))}>
              Reset view
            </button>
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
                <li key={l.n} className={`tm-line is-${status}${venue && venue === shown ? " is-hot" : ""}`}>
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
