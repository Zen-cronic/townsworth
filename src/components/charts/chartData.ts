import type { AuditRow, Verdict } from "@/lib/audit";
import { BUCKETS, type Bucket, type ProgramItem } from "@/lib/plan";

// Pure helpers that turn an audit and a program into chart data. Presentation only: every value is
// a count or a sum of figures the engine already computed. Client-safe (type imports only from lib).

export type LineState = "kept" | "generic" | "unverified";

const kept = (v: Verdict) => v === "grounded" || v === "institution" || v === "mechanism";

export const stateOf = (v: Verdict): LineState => (kept(v) ? "kept" : v === "unverified" ? "unverified" : "generic");

export interface LineComposition {
  total: number;
  kept: number;
  generic: number;
  unverified: number;
  // One entry per draft line, in draft order.
  lines: LineState[];
}

export function lineComposition(audit: Pick<AuditRow, "verdict">[]): LineComposition {
  const lines = audit.map((r) => stateOf(r.verdict));
  const count = (s: LineState) => lines.filter((l) => l === s).length;
  return { total: lines.length, kept: count("kept"), generic: count("generic"), unverified: count("unverified"), lines };
}

// Display order of the program areas in every chart; the reserve always comes last.
export const BUCKET_ORDER: Bucket[] = ["training", "procurement", "grants", "events", "channels"];

export interface FundPart {
  key: Bucket | "reserve";
  label: string;
  amount: number;
  // Share of the 24-month fund, in whole percent (rounded; parts may not sum to exactly 100).
  pct: number;
  items: number;
}

// The 24-month fund split by program area, plus the unassigned reserve. Areas with no money are dropped.
export function fundSplit(items: Pick<ProgramItem, "bucket" | "amount">[], reserve: number): { total: number; parts: FundPart[] } {
  const itemized = items.reduce((s, i) => s + i.amount, 0);
  const total = itemized + Math.max(reserve, 0);
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const parts: FundPart[] = BUCKET_ORDER.map((b) => {
    const mine = items.filter((i) => i.bucket === b);
    const amount = mine.reduce((s, i) => s + i.amount, 0);
    return { key: b, label: BUCKETS[b].label, amount, pct: pct(amount), items: mine.length };
  }).filter((p) => p.amount > 0);
  if (reserve > 0) parts.push({ key: "reserve", label: "Committee reserve", amount: reserve, pct: pct(reserve), items: 0 });
  return { total, parts };
}

export interface PartnerPoint {
  name: string;
  distanceKm?: number;
  affinityRank?: number;
  // How many program items this partner appears in.
  items: number;
}

// Each named local partner once, ranked by Qloo affinity (unranked places last, then by distance).
export function partnerPoints(items: Pick<ProgramItem, "partner">[]): PartnerPoint[] {
  const by = new Map<string, PartnerPoint>();
  for (const it of items) {
    const p = it.partner;
    if (!p) continue;
    const key = p.name.toLowerCase();
    const prev = by.get(key);
    if (prev) prev.items++;
    else by.set(key, { name: p.name, distanceKm: p.distanceKm, affinityRank: p.affinityRank, items: 1 });
  }
  return [...by.values()].sort(
    (a, b) => (a.affinityRank ?? 1e6) - (b.affinityRank ?? 1e6) || (a.distanceKm ?? 1e6) - (b.distanceKm ?? 1e6) || a.name.localeCompare(b.name),
  );
}

export interface SessionRow {
  bucket: Bucket;
  label: string;
  // Month (1-24) -> number of sessions or events scheduled that month.
  months: Map<number, number>;
  sessions: number;
}

// Scheduled sessions per program area and month over the 24-month term.
export function sessionsByBucket(items: Pick<ProgramItem, "bucket" | "months">[]): SessionRow[] {
  return BUCKET_ORDER.map((b) => {
    const months = new Map<number, number>();
    for (const it of items) if (it.bucket === b) for (const m of it.months) months.set(m, (months.get(m) ?? 0) + 1);
    return { bucket: b, label: BUCKETS[b].label, months, sessions: [...months.values()].reduce((s, n) => s + n, 0) };
  }).filter((r) => r.sessions > 0);
}

// Amounts in a sentence: dollar sums, comma-grouped counts, and numbers with million, billion, MW,
// kV or %. Dates, years and small counts are left as text. Odd indexes of the result are amounts.
const FIGURE = /(\$\d+(?:[,.]\d+)*(?:\s?(?:million|billion))?|\d{1,3}(?:,\d{3})+(?:\.\d+)?(?:\s?(?:million|billion))?|\d+(?:\.\d+)?\s?(?:million|billion|MW|kV|%))/g;

export function splitFigures(text: string): string[] {
  return text.split(FIGURE);
}

// Lanes for dots on one axis: each position (0-1) takes the lowest lane where no earlier dot sits
// closer than `gap`, so overlapping dots stack instead of hiding one another. Returns lane per input.
export function stackDots(positions: number[], gap: number): number[] {
  const order = positions.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x);
  const last: number[] = [];
  const lane = new Array<number>(positions.length).fill(0);
  for (const { x, i } of order) {
    let l = 0;
    while (last[l] != null && x - last[l] < gap) l++;
    last[l] = x;
    lane[i] = l;
  }
  return lane;
}
