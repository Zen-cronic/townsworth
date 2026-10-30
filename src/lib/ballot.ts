import type { Bucket, ProgramItem } from "./plan";

// Resident ballot: pure, deterministic helpers shared by the ballot and the committee view.
// Residents rank priorities, not budgets, so a ballot item never carries an amount.

export interface BallotItem {
  id: string;
  bucket: Bucket;
  title: string;
  note?: string;
  partner?: string;
  place?: string;
  distanceKm?: number;
}

export interface Ballot {
  ids: string[];
}

export interface StoredBallot extends Ballot {
  v: 1;
  missing?: string;
  at: string;
}

export interface TallyRow {
  item: BallotItem;
  points: number;
  firstShare: number;
  // rankCounts[r] = ballots that put this item in position r (0 = first).
  rankCounts: number[];
}

export interface Tally {
  rows: TallyRow[];
  ballots: number;
  maxPoints: number;
}

export const SHORTLIST_MAX = 8;
export const SHORTLIST_MIN = 3;
export const SIMULATED_BALLOTS = 120;

// Only buckets residents experience directly go on the ballot. A thin town gets a short ballot, not padding.
export const PRIMARY: Bucket[] = ["grants", "events"];

const MONEY = /\$|\b\d[\d,.]*\s?(k|m|usd|cad|dollars?)\b/gi;
const stripMoney = (s: string) => s.replace(MONEY, "").replace(/\s{2,}/g, " ").trim();

function plainTitle(it: ProgramItem): string {
  const name = it.partner?.name;
  if (it.bucket === "grants" && name) return `A community grant for ${name}`;
  if (it.bucket === "training" && name) return `Trades and apprenticeship info night at ${name}`;
  if (it.bucket === "procurement" && name) return `Local supplier day with ${name}`;
  if (it.id === "events-music") return "A free summer music night";
  if (it.id === "events-local-team") return it.title.replace(/^Community watch party:\s*/, "A free community watch party: ");
  return it.title;
}

// A note only where it says something the row doesn't. Grants and events would all share one
// gloss, so their area label, partner and place carry them instead.
function plainNote(it: ProgramItem): string | undefined {
  if (it.id === "events-music") {
    const theme = it.detail.match(/^Theme signal:\s*([^.]+)\./)?.[1];
    return theme ? `Music in the style the town listens to (${theme}). No artist is booked.` : "Music in the style the town listens to. No artist is booked.";
  }
  if (it.bucket === "training") return "Hiring and apprenticeship information where people already gather.";
  if (it.bucket === "procurement") return "Local businesses get first chance to supply the program.";
  return undefined;
}

export function toBallotItem(it: ProgramItem): BallotItem {
  const note = plainNote(it);
  return {
    id: it.id,
    bucket: it.bucket,
    title: stripMoney(plainTitle(it)),
    note: note ? stripMoney(note) : undefined,
    partner: it.partner?.name,
    place: it.partner?.address,
    distanceKm: it.partner?.distanceKm,
  };
}

// Grants and events, in program order. Training, purchasing and announcement channels are never on the ballot.
export function selectShortlist(items: ProgramItem[], max = SHORTLIST_MAX): BallotItem[] {
  const primary = items.filter((i) => PRIMARY.includes(i.bucket));
  return primary.slice(0, max).map(toBallotItem);
}

// FNV-1a string hash -> 32-bit seed.
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32: small, fast, deterministic PRNG in [0, 1).
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Sample ballots that only exist to show how the tally reads. Each item gets an arbitrary
// seeded lean (random, never derived from Qloo data, distance or list position) and each
// ballot sorts by lean plus a larger random draw, so orderings are close to uniform.
export function simulateBallots(slug: string, ids: string[], count = SIMULATED_BALLOTS): Ballot[] {
  const rng = mulberry32(hashSeed(`ballot:${slug}:${ids.join("|")}`));
  const lean = new Map(ids.map((id) => [id, rng() * 0.25]));
  return Array.from({ length: count }, () => {
    const scored = ids.map((id) => ({ id, s: (lean.get(id) ?? 0) + rng() + rng() }));
    scored.sort((a, b) => b.s - a.s);
    return { ids: scored.map((x) => x.id) };
  });
}

// A ballot counts only if it is a full ranking of exactly this shortlist.
export function isValidBallot(ids: unknown, shortlist: string[]): ids is string[] {
  if (!Array.isArray(ids) || ids.length !== shortlist.length) return false;
  const want = new Set(shortlist);
  return new Set(ids).size === ids.length && ids.every((id) => typeof id === "string" && want.has(id));
}

// Borda count: on an n-item ballot, first place earns n-1 points and last earns 0.
export function borda(items: BallotItem[], ballots: Ballot[]): Tally {
  const n = items.length;
  const index = new Map(items.map((it, i) => [it.id, i]));
  const points = new Array<number>(n).fill(0);
  const counts = items.map(() => new Array<number>(n).fill(0));
  let valid = 0;
  for (const b of ballots) {
    if (!isValidBallot(b.ids, items.map((i) => i.id))) continue;
    valid++;
    b.ids.forEach((id, r) => {
      const i = index.get(id)!;
      points[i] += n - 1 - r;
      counts[i][r]++;
    });
  }
  const rows = items
    .map((item, i) => ({
      item,
      points: points[i],
      firstShare: valid ? counts[i][0] / valid : 0,
      rankCounts: counts[i],
    }))
    .sort((a, b) => b.points - a.points || b.rankCounts[0] - a.rankCounts[0] || a.item.id.localeCompare(b.item.id));
  return { rows, ballots: valid, maxPoints: valid * Math.max(0, n - 1) };
}

// Spreadsheet apps run a cell that starts with =, +, -, @, tab or CR as a formula; a leading quote keeps it text.
export const guardFormula = (s: string) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);

const csvCell = (v: string | number) => {
  const s = typeof v === "string" ? guardFormula(v) : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function tallyCsv(tally: Tally, basis: string): string {
  const n = tally.rows.length;
  const header = ["rank", "item", "partner", "borda_points", "first_choice_share", ...Array.from({ length: n }, (_, r) => `ranked_${r + 1}`), "ballots", "basis"];
  const lines = tally.rows.map((row, i) =>
    [i + 1, row.item.title, row.item.partner ?? "", row.points, `${(row.firstShare * 100).toFixed(1)}%`, ...row.rankCounts, tally.ballots, basis].map(csvCell).join(","),
  );
  return [header.join(","), ...lines].join("\n") + "\n";
}

export const ballotKey = (slug: string) => `good-neighbor:ballot:${slug}`;
