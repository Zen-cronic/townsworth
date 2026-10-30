import type { AuditRow } from "./audit";
import type { Bucket } from "./buckets";
import type { ProgramItem } from "./plan";

// The town map's data: the facility site, every program venue Qloo can place, and the plan flows
// from the site to each venue. Built on the server from a finished run and sent to the client as
// plain JSON, so the map, the swap toggles and the totals never call Qloo again.
// Display only: nothing in the planner or the audit reads it.

export interface LatLon {
  lat: number;
  lon: number;
}

// ranked: a Qloo place with a local-favour rank (blue). kept: a place a kept draft line named,
// matched in Qloo (green). unranked: a Qloo place without a rank (hollow).
export type VenueKind = "ranked" | "kept" | "unranked";

export interface MapVenue extends LatLon {
  key: string;
  name: string;
  kind: VenueKind;
  rank?: number;
  distanceKm?: number;
  city?: string;
}

// One flow from the site to a venue: a costed program item, or a kept line's own venue (no cost).
export interface MapLeg {
  id: string;
  line?: number;
  venue: string;
  bucket: Bucket;
  title: string;
  amount: number;
  cadence?: string;
}

export type LineStatus = "kept" | "struck" | "unsure";

export interface MapLine {
  // 1-based, as on the page ("Line 4", #line-4).
  n: number;
  anchor: string;
  text: string;
  bucket: Bucket;
  status: LineStatus;
  // Legs that stay whichever way the toggle is set (a kept line's venue, items added alongside it).
  legs: MapLeg[];
  // A struck line's like-for-like local item; only drawn when the swap is chosen.
  swap?: MapLeg;
  // The venue name, for the panel.
  venueName?: string;
}

// A partner the page names that Qloo can't place on the map (OpenStreetMap-only matches, or no
// coordinates). Listed, never drawn.
export interface Unplaced {
  name: string;
  distanceKm?: number;
  source: string;
  line?: number;
}

export interface MapData {
  site: LatLon & { label: string };
  radiusKm: number;
  placeCount: number;
  twoYearFund: number;
  lines: MapLine[];
  // Program items the draft never named: always drawn, never toggled.
  extras: MapLeg[];
  venues: MapVenue[];
  places: (LatLon & { name: string; rank?: number })[];
  unplaced: Unplaced[];
}

export type Choice = "drafted" | "swap";

export interface MapInput {
  site: LatLon & { label: string };
  radiusKm: number;
  placeCount: number;
  twoYearFund: number;
  audit: AuditRow[];
  anchors: string[];
  qlooAdds: ProgramItem[];
  localPlaces: { id: string; name: string; location?: LatLon }[];
  rankOf: (id: string) => number | undefined;
}

const keep = (v: AuditRow["verdict"]) => v === "grounded" || v === "institution" || v === "mechanism";
const clean = (name: string) => name.split(" | ")[0].trim();
const keyOf = (name: string) => clean(name).toLowerCase();

export function buildMapData(input: MapInput): MapData {
  const venues = new Map<string, MapVenue>();
  const unplaced: Unplaced[] = [];
  const seenUnplaced = new Set<string>();
  const placeByName = new Map(input.localPlaces.map((p) => [keyOf(p.name), p]));

  const noteUnplaced = (u: Unplaced) => {
    const k = keyOf(u.name);
    if (seenUnplaced.has(k) || venues.has(k)) return;
    seenUnplaced.add(k);
    unplaced.push(u);
  };

  const addVenue = (v: MapVenue) => {
    const prev = venues.get(v.key);
    // A place a kept line named stays green even when a costed item also uses it.
    if (!prev) venues.set(v.key, v);
    else if (v.kind === "kept") prev.kind = "kept";
  };

  const legOf = (item: ProgramItem, line?: number): MapLeg | undefined => {
    const p = item.partner;
    if (!p) return undefined;
    const key = keyOf(p.name);
    if (!p.location) {
      noteUnplaced({ name: clean(p.name), distanceKm: p.distanceKm, source: "Qloo", line });
      return undefined;
    }
    addVenue({ key, name: clean(p.name), lat: p.location.lat, lon: p.location.lon, kind: p.affinityRank ? "ranked" : "unranked", rank: p.affinityRank, distanceKm: p.distanceKm, city: p.city });
    return { id: item.id, line, venue: key, bucket: item.bucket, title: item.title, amount: item.amount, cadence: item.cadence };
  };

  const lines: MapLine[] = input.audit.map((row, i) => {
    const n = i + 1;
    const kept = keep(row.verdict);
    const legs: MapLeg[] = [];
    let venueName: string | undefined;
    if (kept && row.matched) {
      const place = row.matched.source === "qloo" ? placeByName.get(keyOf(row.matched.name)) : undefined;
      if (place?.location) {
        const key = keyOf(place.name);
        addVenue({ key, name: clean(place.name), lat: place.location.lat, lon: place.location.lon, kind: "kept", rank: input.rankOf(place.id), distanceKm: row.matched.distanceKm });
        legs.push({ id: `kept-${n}`, line: n, venue: key, bucket: row.bucket, title: row.text, amount: 0 });
        venueName = clean(place.name);
      } else {
        noteUnplaced({ name: clean(row.matched.name), distanceKm: row.matched.distanceKm, source: row.matched.source === "osm" ? "OpenStreetMap" : "Qloo", line: n });
      }
    }
    for (const it of [row.alongside, ...(row.applicants ?? [])]) {
      const leg = it && legOf(it, n);
      if (leg) {
        legs.push(leg);
        venueName ??= venues.get(leg.venue)?.name;
      }
    }
    const swap = !kept && row.replacement ? legOf(row.replacement, n) : undefined;
    if (swap) venueName ??= venues.get(swap.venue)?.name;
    else if (!kept && row.replacement?.partner) venueName ??= clean(row.replacement.partner.name);
    return {
      n,
      anchor: input.anchors[i] ?? `line-${n}`,
      text: row.text,
      bucket: row.bucket,
      status: kept ? "kept" : row.verdict === "unverified" ? "unsure" : "struck",
      legs,
      swap,
      venueName,
    };
  });

  const extras = input.qlooAdds.map((it) => legOf(it)).filter((l): l is MapLeg => !!l);

  const places = input.localPlaces
    .filter((p): p is typeof p & { location: LatLon } => !!p.location)
    .map((p) => ({ lat: p.location.lat, lon: p.location.lon, name: clean(p.name), rank: input.rankOf(p.id) }));

  return {
    site: input.site,
    radiusKm: input.radiusKm,
    placeCount: input.placeCount,
    twoYearFund: input.twoYearFund,
    lines,
    extras,
    venues: [...venues.values()],
    places,
    unplaced,
  };
}

// Every struck line that has a swap starts as drafted; the reader flips lines (or applies them all)
// and watches the local flows draw in.
export function defaultChoices(data: Pick<MapData, "lines">, choice: Choice = "drafted"): Record<number, Choice> {
  return Object.fromEntries(data.lines.filter((l) => l.swap).map((l) => [l.n, choice]));
}

export interface PlanState {
  // The legs drawn for the current choices, before the area filter.
  active: MapLeg[];
  // The legs the area filter leaves visible.
  visible: MapLeg[];
  localLines: number;
  totalLines: number;
  // Local program total over the term: each costed item counted once.
  total: number;
  // Venues with at least one visible leg.
  venues: Set<string>;
}

// Recomputes the flows and totals for a set of toggle choices and a program-area filter.
// A kept line is local either way; a struck line is local only when its swap is chosen.
export function planState(data: Pick<MapData, "lines" | "extras">, choices: Record<number, Choice>, hidden: ReadonlySet<Bucket> = new Set()): PlanState {
  const active: MapLeg[] = [];
  let localLines = 0;
  for (const line of data.lines) {
    const swapped = !!line.swap && choices[line.n] !== "drafted";
    if (line.status === "kept" || swapped) localLines++;
    active.push(...line.legs);
    if (swapped && line.swap) active.push(line.swap);
  }
  active.push(...data.extras);
  const seen = new Set<string>();
  const unique = active.filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true)));
  const visible = unique.filter((l) => !hidden.has(l.bucket));
  return {
    active: unique,
    visible,
    localLines,
    totalLines: data.lines.length,
    total: unique.reduce((s, l) => s + l.amount, 0),
    venues: new Set(visible.map((l) => l.venue)),
  };
}

// A curved flow from a to b: a quadratic Bezier bowed to one side by `bend` (a share of the
// straight-line length), in `steps` segments. Plain lon/lat maths, fine over a 15 km radius.
export function arcCoords(a: LatLon, b: LatLon, bend = 0.22, steps = 32): [number, number][] {
  const dx = b.lon - a.lon;
  const dy = b.lat - a.lat;
  const cx = (a.lon + b.lon) / 2 - dy * bend;
  const cy = (a.lat + b.lat) / 2 + dx * bend;
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    out.push([u * u * a.lon + 2 * u * t * cx + t * t * b.lon, u * u * a.lat + 2 * u * t * cy + t * t * b.lat]);
  }
  return out;
}

// Line width in pixels from an item's cost: uncosted legs stay hairline, the largest is 7 px.
export function legWidth(amount: number, max: number): number {
  if (!amount || !max) return 1.5;
  return Math.round((2 + 5 * Math.sqrt(amount / max)) * 10) / 10;
}

// A circle polygon (the Qloo search radius), as a closed lon/lat ring.
export function circleRing(c: LatLon, km: number, steps = 96): [number, number][] {
  const out: [number, number][] = [];
  const dLat = km / 110.574;
  const dLon = km / (111.32 * Math.cos((c.lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    out.push([c.lon + dLon * Math.cos(a), c.lat + dLat * Math.sin(a)]);
  }
  return out;
}
