import type { QlooEntity } from "./qloo";
import { categories, signalTags } from "./filters";
import type { Signal, TownProfile } from "./profile";

// Deterministic program builder. Qloo supplies the local candidates; fixed policy decides
// allocation and cadence. Costs come from the fund the user enters, never from Qloo.

export type Bucket = "training" | "procurement" | "grants" | "events" | "channels";

export const BUCKETS: Record<Bucket, { label: string; share: number; cadence: string }> = {
  training: { label: "Trades & training nights", share: 0.3, cadence: "Quarterly" },
  procurement: { label: "Local purchasing", share: 0.25, cadence: "Twice a year" },
  grants: { label: "Community fund grants", share: 0.3, cadence: "Annual cycle" },
  events: { label: "Community events", share: 0.1, cadence: "Seasonal" },
  channels: { label: "Where to announce it", share: 0.05, cadence: "Ongoing" },
};

export interface Provenance {
  signal: string;
  detail: string;
}

export interface Partner {
  name: string;
  address?: string;
  distanceKm?: number;
  phone?: string;
  website?: string;
  rating?: number;
  eventSpaces?: boolean;
}

export interface ProgramItem {
  id: string;
  bucket: Bucket;
  title: string;
  detail: string;
  partner?: Partner;
  amount: number;
  months: number[];
  provenance: Provenance[];
}

export interface Program {
  items: ProgramItem[];
  annualFund: number;
  totalAllocated: number;
  costNote: string;
}

const VENUE = /^(event venue|banquet hall|wedding venue|live music venue|concert hall|conference center|convention center|community center|brewery|pub|bar grill|wine bar|performing arts theater|library|meeting planning service)$/i;
const INSTITUTION = /^(museum|art museum|history museum|park|city park|zoo|botanical garden|historical landmark|university|college|non profit organization|library|hiking area|nature preserve|community center|festival|performing arts theater|aquarium|arboretum)$/i;
const SUPPLIER = /^(bakery|caterer|coffee shop|cafe|diner|deli|barbecue restaurant|produce market|farm|brewery|family restaurant|breakfast restaurant|sandwich shop|pizza restaurant|ice cream shop|dessert shop|butcher shop|farmers market|winery|distillery|bar grill)$/i;

const km = (m?: number) => (m == null ? undefined : Math.round(m / 100) / 10);

const hasCategory = (e: QlooEntity, re: RegExp) => categories(e).some((c) => re.test(c));

function partnerOf(e: QlooEntity): Partner {
  return {
    name: e.name,
    address: e.address,
    distanceKm: km(e.distanceM),
    phone: e.phone,
    website: e.website,
    rating: e.rating,
    eventSpaces: e.eventSpaces,
  };
}

function placeProvenance(e: QlooEntity, why: string): Provenance[] {
  const tags = categories(e).slice(0, 2).concat(signalTags(e).filter((t) => t.type === "urn:tag:ambience:qloo").slice(0, 1).map((t) => t.name)).join(", ");
  return [
    {
      signal: `Qloo place · ${km(e.distanceM) ?? "?"} km away`,
      detail: `${why}${tags ? `. Tagged: ${tags}` : ""}${e.rating ? `. Rating ${e.rating.toFixed(1)}` : ""}`,
    },
  ];
}

function signalProvenance(s: Signal, typeLabel: string): Provenance {
  return {
    signal: `Qloo ${typeLabel} · #${s.rank} locally`,
    detail: s.distinct
      ? "Over-indexes here: not in the national top 20"
      : `Also popular nationally (#${s.nationalRank})`,
  };
}

function pick<T>(list: T[], n: number, used: Set<string>, key: (x: T) => string) {
  const out: T[] = [];
  for (const x of list) {
    if (out.length >= n) break;
    const k = key(x);
    if (used.has(k)) continue;
    used.add(k);
    out.push(x);
  }
  return out;
}

function spread(count: number, every: number, offset: number) {
  return Array.from({ length: count }, (_, i) => Math.min(24, offset + i * every));
}

export function buildProgram(profile: TownProfile, annualFund: number): Program {
  const used = new Set<string>();
  const byDistance = [...profile.localPlaces].sort((a, b) => (a.distanceM ?? 1e9) - (b.distanceM ?? 1e9));
  const twoYear = annualFund * 2;
  const items: ProgramItem[] = [];

  const venues = pick(byDistance.filter((p) => hasCategory(p, VENUE)), 4, used, (p) => p.id);
  venues.forEach((v, i) =>
    items.push({
      id: `training-${i}`,
      bucket: "training",
      title: `Trades-training info night at ${v.name}`,
      detail: "Apprenticeship and hiring info sessions where people already gather, not at the facility.",
      partner: partnerOf(v),
      amount: 0,
      months: spread(2, 12, 2 + i * 3),
      provenance: placeProvenance(v, v.eventSpaces ? "Has event space" : "Local gathering place"),
    }),
  );

  const suppliers = pick(byDistance.filter((p) => hasCategory(p, SUPPLIER)), 4, used, (p) => p.id);
  suppliers.forEach((s, i) =>
    items.push({
      id: `procurement-${i}`,
      bucket: "procurement",
      title: `Supplier day: ${s.name}`,
      detail: "Invite to bid on catering, events and site services before going to regional vendors.",
      partner: partnerOf(s),
      amount: 0,
      months: spread(2, 12, 4 + i * 2),
      provenance: placeProvenance(s, "Independent local business"),
    }),
  );

  const institutions = pick(byDistance.filter((p) => hasCategory(p, INSTITUTION)), 4, used, (p) => p.id);
  institutions.forEach((inst, i) =>
    items.push({
      id: `grants-${i}`,
      bucket: "grants",
      title: `Community grant: ${inst.name}`,
      detail: "Shortlisted for the resident ballot. Residents rank; the committee decides.",
      partner: partnerOf(inst),
      amount: 0,
      months: [9 + (i % 2), 21 + (i % 2)],
      provenance: placeProvenance(inst, "Local institution residents visit"),
    }),
  );

  const localBrands = profile.taste.brand.filter((s) => s.distinct).slice(0, 8);
  const localArtists = profile.taste.artist.filter((s) => s.distinct).slice(0, 3);
  if (localArtists.length) {
    items.push({
      id: "events-music",
      bucket: "events",
      title: `Summer music night in the style the town over-indexes on`,
      detail: `Theme signal: ${localArtists.map((a) => a.entity.name).join(", ")}. A theme, not a booking: no artist is contacted or implied.`,
      amount: 0,
      months: [7, 19],
      provenance: localArtists.map((a) => signalProvenance(a, "artist")),
    });
  }
  const team = localBrands.find((b) => /sports organization|league|football|hockey|baseball|basketball|soccer/i.test(b.entity.tags.map((t) => t.name).join(" ")));
  if (team) {
    items.push({
      id: "events-local-team",
      bucket: "events",
      title: `Community watch party: ${team.entity.name}`,
      detail: "Free, open to all, hosted at a local venue from this plan. Built around a team the town over-indexes on.",
      amount: 0,
      months: [10, 22],
      provenance: [signalProvenance(team, "brand")],
    });
  }
  const channels = [...profile.taste.podcast, ...profile.taste.tv_show].filter((s) => s.distinct).slice(0, 3);
  if (channels.length) {
    items.push({
      id: "channels",
      bucket: "channels",
      title: "Announce the program where the town already listens and watches",
      detail: channels.map((c) => c.entity.name).join(" · "),
      amount: 0,
      months: [1, 13],
      provenance: channels.map((c) => signalProvenance(c, c.entity.type === "podcast" ? "podcast" : "TV show")),
    });
  }

  for (const [bucket, meta] of Object.entries(BUCKETS) as [Bucket, (typeof BUCKETS)[Bucket]][]) {
    const inBucket = items.filter((it) => it.bucket === bucket);
    const each = inBucket.length ? Math.round((twoYear * meta.share) / inBucket.length / 100) * 100 : 0;
    inBucket.forEach((it) => (it.amount = each));
  }

  return {
    items,
    annualFund,
    totalAllocated: items.reduce((s, it) => s + it.amount, 0),
    costNote:
      "Amounts split your fund by fixed policy shares (training 30%, purchasing 25%, grants 30%, events 10%, announcements 5%) over 24 months. Qloo supplies the partners and signals, not the costs.",
  };
}
