import type { QlooEntity } from "./qloo";
import { categories, signalTags } from "./filters";
import type { PlaceMeta, Signal, TownProfile } from "./profile";

// Deterministic program builder. Qloo supplies the local candidates and ranks them by local
// affinity; fixed policy decides venues, schedule and cost. Costs come from a per-event model
// and the fund the user enters, never from Qloo.

export type Bucket = "training" | "procurement" | "grants" | "events" | "channels";

// `cadence` is the fallback label; the program computes the real one from its scheduled months.
export const BUCKETS: Record<Bucket, { label: string; cadence: string }> = {
  training: { label: "Trades & training nights", cadence: "Quarterly" },
  procurement: { label: "Local purchasing", cadence: "Quarterly" },
  grants: { label: "Community fund grants", cadence: "Once a year" },
  events: { label: "Community events", cadence: "Once a year" },
  channels: { label: "Where to announce it", cadence: "At launch, then month 13" },
};

export interface Provenance {
  signal: string;
  detail: string;
}

// What the partner is to the item. The budget pays for running the item, never the partner.
export type PartnerRole = "host" | "supplier" | "applicant";

export const ROLE_LABEL: Record<PartnerRole, string> = {
  host: "Host venue",
  supplier: "Invited supplier",
  applicant: "Suggested applicant",
};

export interface Partner {
  name: string;
  address?: string;
  city?: string;
  distanceKm?: number;
  phone?: string;
  website?: string;
  rating?: number;
  eventSpaces?: boolean;
  // Outside the host community (different town and more than about 8 km away).
  neighbouring?: boolean;
  affinityRank?: number;
}

export interface ProgramItem {
  id: string;
  bucket: Bucket;
  title: string;
  detail: string;
  partner?: Partner;
  role?: PartnerRole;
  // A kept institution from the draft that runs this item (e.g. the technical college).
  runWith?: string;
  amount: number;
  sessions: number;
  unitCost: number;
  unit: string;
  costBasis: string;
  months: number[];
  cadence: string;
  provenance: Provenance[];
}

export interface Program {
  items: ProgramItem[];
  annualFund: number;
  twoYearFund: number;
  totalAllocated: number;
  // Fund left after the itemized program: the committee allocates it, the tool doesn't.
  unassigned: number;
  cadence: Record<Bucket, string>;
  costNote: string;
  // Partner picks under Qloo affinity ranking vs a distance-only ranking of the same candidates.
  picks: { affinity: string[]; distance: string[] };
}

// Per-event cost model (USD). Each unit cost is the budget to run one session, not a payment to a partner.
const UNIT = {
  training: { cost: 9000, unit: "session", basis: "instructor $3,000 · participant stipends $2,500 · childcare $1,500 · venue hire and food $2,000" },
  procurement: { cost: 6000, unit: "session", basis: "bid-readiness coach $2,500 · venue hire $1,500 · food $1,000 · materials and translation $1,000" },
  music: { cost: 30000, unit: "event", basis: "stage and sound $12,000 · local performers $8,000 · permits and security $6,000 · accessibility $4,000" },
  watch: { cost: 8000, unit: "event", basis: "venue hire $3,000 · screen and AV $2,000 · food $2,000 · accessibility $1,000" },
  channels: { cost: 12000, unit: "wave", basis: "household mailer $6,000 · local radio and podcast spots $4,000 · translation $2,000" },
} as const;
// Grants keep the larger amounts: up to 30% of the two-year fund, at most $100,000 per grantee per cycle.
const GRANT_SHARE = 0.3;
const GRANT_CAP_PER_CYCLE = 100_000;
const GRANT_CYCLES = [9, 21];
// Non-grant items never take more than this share of the fund; above it, unit costs scale down.
const NON_GRANT_CEILING = 0.7;

// Training-night hosts: places with room for a workforce evening. Event venues inside restaurants,
// orchards, farms, petting zoos and diners don't qualify. Breweries are a fallback for adult sessions.
const HALL = /^(banquet hall|conference center|convention center|community center|auditorium|library|public library|college|community college|university|public university|performing arts theater|meeting planning service|cultural center|civic center|event venue)$/i;
const ADULT_VENUE = /^(brewery|brewpub|beer garden|beer hall)$/i;
const NOT_A_TRAINING_HOST = /orchard|farm|petting zoo|\bzoo\b|diner|fast food|amusement|gift shop|ice cream|golf|country club/i;
const DINING = /restaurant|diner|cafe|coffee|pizza|grill|eatery|steak house|takeout|buffet|pub\b|\bbar\b|mexican|american|italian/i;

const INSTITUTION = /^(museum|art museum|history museum|park|city park|zoo|botanical garden|historical landmark|university|public university|college|non profit organization|library|hiking area|nature preserve|community center|festival|performing arts theater|aquarium|arboretum)$/i;
const SUPPLIER = /^(bakery|caterer|coffee shop|cafe|diner|deli|barbecue restaurant|produce market|farm|brewery|family restaurant|breakfast restaurant|sandwich shop|pizza restaurant|ice cream shop|dessert shop|butcher shop|farmers market|winery|distillery|bar grill|landscaper|garden center|florist)$/i;

const km = (m?: number) => (m == null ? undefined : Math.round(m / 100) / 10);

const hasCategory = (e: QlooEntity, re: RegExp) => categories(e).some((c) => re.test(c));

// Qloo place names sometimes carry a "| City" suffix; the distance already says where it is.
export const cleanName = (name: string) => name.split(" | ")[0].trim();

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

function trainingTier(e: QlooEntity): number | null {
  const cats = categories(e);
  if (NOT_A_TRAINING_HOST.test(e.name) || cats.some((c) => NOT_A_TRAINING_HOST.test(c))) return null;
  const halls = cats.filter((c) => HALL.test(c));
  const dining = cats.some((c) => DINING.test(c));
  // "Event venue" alone on a restaurant is a back room, not a training venue.
  if (halls.some((c) => !/^event venue$/i.test(c)) || (halls.length && !dining)) return 0;
  if (cats.some((c) => ADULT_VENUE.test(c))) return 1;
  return null;
}

function partnerOf(e: QlooEntity, meta?: PlaceMeta): Partner {
  return {
    name: cleanName(e.name),
    address: e.address,
    city: meta?.city ?? e.city,
    distanceKm: km(e.distanceM),
    phone: e.phone,
    website: e.website,
    rating: e.rating,
    eventSpaces: e.eventSpaces,
    neighbouring: meta ? !meta.host : undefined,
    affinityRank: meta?.affinityRank,
  };
}

function placeProvenance(e: QlooEntity, why: string, profile: TownProfile): Provenance[] {
  const meta = profile.placeMeta.get(e.id);
  const tags = categories(e).slice(0, 2).concat(signalTags(e).filter((t) => t.type === "urn:tag:ambience:qloo").slice(0, 1).map((t) => t.name)).join(", ");
  const where = meta && !meta.host ? `neighbouring community${meta.city ? ` (${meta.city})` : ""}` : "host community";
  const rank = meta?.affinityRank;
  return [
    {
      signal: rank ? `Qloo place · #${rank} by local affinity` : `Qloo place · ${km(e.distanceM) ?? "?"} km away`,
      detail: `${
        rank
          ? `#${rank} by local affinity of ${profile.placeCount} Qloo places within 15 km. `
          : "Qloo has no local-affinity score for this place, so it is listed by distance. "
      }${km(e.distanceM) ?? "?"} km from the site, ${where}. ${why}${tags ? `. Tagged: ${tags}` : ""}${e.rating ? `. Rating ${e.rating.toFixed(1)}` : ""}`,
    },
  ];
}

function signalProvenance(s: Signal, typeLabel: string): Provenance {
  return {
    signal: `Qloo ${typeLabel} · #${s.rank} locally`,
    detail: s.distinct ? "Over-indexes here: not in the national top 50 or any big-metro list" : `Also popular nationally (#${s.nationalRank})`,
  };
}

export type Ranking = "affinity" | "distance";

// Host community first, then Qloo's local affinity rank; distance only breaks ties.
// The distance-only ranking is the counterfactual "nearby-places directory" used on /proof.
function ordered(list: QlooEntity[], profile: TownProfile, ranking: Ranking, tier: (e: QlooEntity) => number = () => 0) {
  const meta = (e: QlooEntity) => profile.placeMeta.get(e.id);
  return [...list].sort(
    (a, b) =>
      tier(a) - tier(b) ||
      Number(!meta(a)?.host) - Number(!meta(b)?.host) ||
      (ranking === "affinity" ? (meta(a)?.affinityRank ?? 1e6) - (meta(b)?.affinityRank ?? 1e6) : 0) ||
      (a.distanceM ?? 1e9) - (b.distanceM ?? 1e9),
  );
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

// The same candidate pools and fit rules for both rankings; only the order differs.
function selectPartners(profile: TownProfile, ranking: Ranking) {
  const used = new Set<string>();
  const pool = profile.localPlaces;
  const venues = pick(
    ordered(pool.filter((p) => trainingTier(p) !== null), profile, ranking, (p) => trainingTier(p) ?? 9),
    4,
    used,
    (p) => p.id,
  );
  const suppliers = pick(ordered(pool.filter((p) => hasCategory(p, SUPPLIER)), profile, ranking), 4, used, (p) => p.id);
  const institutions = pick(ordered(pool.filter((p) => hasCategory(p, INSTITUTION)), profile, ranking), 4, used, (p) => p.id);
  return { venues, suppliers, institutions };
}

// Spread the bucket's dated sessions round-robin over the picked partners, so it keeps its cadence.
function roundRobin(count: number, months: number[]) {
  if (!count) return [];
  const out = Array.from({ length: count }, () => [] as number[]);
  months.forEach((m, i) => out[i % count].push(m));
  return out;
}

export function cadenceOf(months: number[]): string {
  const ms = [...new Set(months)].sort((a, b) => a - b);
  if (!ms.length) return "Not scheduled";
  if (ms.length === 1) return `Once (month ${ms[0]})`;
  const gaps = ms.slice(1).map((m, i) => m - ms[i]);
  const g = gaps[0];
  if (gaps.every((x) => x === g)) {
    if (g === 3) return "Quarterly";
    if (g === 6) return "Twice a year";
    if (g === 12) return ms.length === 2 ? `Once a year (months ${ms[0]} and ${ms[1]})` : "Once a year";
    if (g === 1) return "Monthly";
  }
  return `${ms.length} dates (months ${ms.join(", ")})`;
}

const QUARTERLY_TRAINING = [2, 5, 8, 11, 14, 17, 20, 23];
const QUARTERLY_SUPPLIER = [3, 6, 9, 12, 15, 18, 21, 24];

function costed(base: Omit<ProgramItem, "amount" | "cadence">): ProgramItem {
  return { ...base, amount: base.sessions * base.unitCost, cadence: cadenceOf(base.months) };
}

export function buildProgram(profile: TownProfile, annualFund: number): Program {
  const twoYear = annualFund * 2;
  const items: ProgramItem[] = [];
  const { venues, suppliers, institutions } = selectPartners(profile, "affinity");
  const meta = (e: QlooEntity) => profile.placeMeta.get(e.id);

  roundRobin(venues.length, QUARTERLY_TRAINING).forEach((months, i) => {
    const v = venues[i];
    const adult = trainingTier(v) === 1;
    items.push(
      costed({
        id: `training-${i}`,
        bucket: "training",
        title: `Trades-training info night at ${cleanName(v.name)}`,
        detail: `Apprenticeship and hiring info sessions where people already gather, not at the facility.${adult ? " Adult (21+) venue: evening sessions for adult learners." : ""}`,
        partner: partnerOf(v, meta(v)),
        role: "host",
        sessions: months.length,
        unitCost: UNIT.training.cost,
        unit: UNIT.training.unit,
        costBasis: UNIT.training.basis,
        months,
        provenance: placeProvenance(v, v.eventSpaces ? "Has event space" : "Local gathering place", profile),
      }),
    );
  });

  roundRobin(suppliers.length, QUARTERLY_SUPPLIER).forEach((months, i) => {
    const s = suppliers[i];
    items.push(
      costed({
        id: `procurement-${i}`,
        bucket: "procurement",
        title: `Supplier day: ${cleanName(s.name)}`,
        detail: "Invited to bid on catering, events and site services before regional vendors. The budget runs the bid-readiness session.",
        partner: partnerOf(s, meta(s)),
        role: "supplier",
        sessions: months.length,
        unitCost: UNIT.procurement.cost,
        unit: UNIT.procurement.unit,
        costBasis: UNIT.procurement.basis,
        months,
        provenance: placeProvenance(s, "Independent local business", profile),
      }),
    );
  });

  const grantPerCycle = institutions.length
    ? Math.min(GRANT_CAP_PER_CYCLE, Math.floor((twoYear * GRANT_SHARE) / institutions.length / GRANT_CYCLES.length / 500) * 500)
    : 0;
  institutions.forEach((inst, i) =>
    items.push(
      costed({
        id: `grants-${i}`,
        bucket: "grants",
        title: `Community grant: ${cleanName(inst.name)}`,
        detail: "Shortlisted for the resident ballot as a suggested applicant. Residents rank; the committee decides.",
        partner: partnerOf(inst, meta(inst)),
        role: "applicant",
        sessions: GRANT_CYCLES.length,
        unitCost: grantPerCycle,
        unit: "cycle",
        costBasis: `up to ${usd(grantPerCycle)} per grant cycle (cap ${usd(GRANT_CAP_PER_CYCLE)}), awarded by the committee`,
        months: GRANT_CYCLES,
        provenance: placeProvenance(inst, "Local institution residents visit", profile),
      }),
    ),
  );

  // Only taste types that carry a local signal build items (see TasteStrength).
  const localOf = (t: keyof TownProfile["strength"]) => (profile.strength[t].local ? profile.taste[t].filter((s) => s.distinct) : []);
  const localBrands = localOf("brand").slice(0, 8);
  const localArtists = localOf("artist").slice(0, 3);
  if (localArtists.length) {
    items.push(
      costed({
        id: "events-music",
        bucket: "events",
        title: `Summer music night in the style the town over-indexes on`,
        detail: `Theme signal: ${localArtists.map((a) => a.entity.name).join(", ")}. A theme, not a booking: no artist is contacted or implied.`,
        sessions: 2,
        unitCost: UNIT.music.cost,
        unit: UNIT.music.unit,
        costBasis: UNIT.music.basis,
        months: [7, 19],
        provenance: localArtists.map((a) => signalProvenance(a, "artist")),
      }),
    );
  }
  const team = localBrands.find((b) => /sports organization|league|football|hockey|baseball|basketball|soccer/i.test(b.entity.tags.map((t) => t.name).join(" ")));
  if (team) {
    items.push(
      costed({
        id: "events-local-team",
        bucket: "events",
        title: `Community watch party: ${team.entity.name}`,
        detail: "Free, all ages, at a host venue from this plan. Built around a team the town over-indexes on.",
        sessions: 2,
        unitCost: UNIT.watch.cost,
        unit: UNIT.watch.unit,
        costBasis: UNIT.watch.basis,
        months: [10, 22],
        provenance: [signalProvenance(team, "brand")],
      }),
    );
  }
  const channels = [...localOf("podcast"), ...localOf("tv_show")].slice(0, 3);
  if (channels.length) {
    items.push(
      costed({
        id: "channels",
        bucket: "channels",
        title: "Announce the program where the town already listens and watches",
        detail: channels.map((c) => c.entity.name).join(" · "),
        sessions: 2,
        unitCost: UNIT.channels.cost,
        unit: UNIT.channels.unit,
        costBasis: UNIT.channels.basis,
        months: [1, 13],
        provenance: channels.map((c) => signalProvenance(c, c.entity.type === "podcast" ? "podcast" : "TV show")),
      }),
    );
  }

  // A small fund scales the per-event costs down so the itemized program never exceeds it.
  const nonGrant = items.filter((it) => it.bucket !== "grants");
  const nonGrantTotal = nonGrant.reduce((s, it) => s + it.amount, 0);
  const ceiling = twoYear * NON_GRANT_CEILING;
  const scaled = nonGrantTotal > ceiling && nonGrantTotal > 0;
  if (scaled) {
    const f = ceiling / nonGrantTotal;
    for (const it of nonGrant) {
      it.unitCost = Math.floor((it.unitCost * f) / 100) * 100;
      it.amount = it.sessions * it.unitCost;
    }
  }

  const totalAllocated = items.reduce((s, it) => s + it.amount, 0);
  const cadence = Object.fromEntries(
    (Object.keys(BUCKETS) as Bucket[]).map((b) => [b, cadenceOf(items.filter((it) => it.bucket === b).flatMap((it) => it.months))]),
  ) as Record<Bucket, string>;
  const distance = selectPartners(profile, "distance");

  return {
    items,
    annualFund,
    twoYearFund: twoYear,
    totalAllocated,
    unassigned: Math.max(0, twoYear - totalAllocated),
    cadence,
    picks: {
      affinity: [...venues, ...suppliers, ...institutions].map((e) => e.id),
      distance: [...distance.venues, ...distance.suppliers, ...distance.institutions].map((e) => e.id),
    },
    costNote: `Each item is costed per session or event (sessions × unit cost: training night ${usd(UNIT.training.cost)}, supplier day ${usd(UNIT.procurement.cost)}, watch party ${usd(UNIT.watch.cost)}, music night ${usd(UNIT.music.cost)}, announcement wave ${usd(UNIT.channels.cost)}). Unit costs cover instructors, stipends, childcare and venue hire; they are not payments to the partner. Grants take up to 30% of the fund, capped at ${usd(GRANT_CAP_PER_CYCLE)} per grantee per cycle. ${scaled ? "Unit costs were scaled down to fit this fund. " : ""}The rest stays unassigned for the committee to allocate. Qloo supplies the partners and signals, not the costs.`,
  };
}

// "Host venue: X · 2 sessions × $9,000". The partner hosts or is invited; the budget runs the item.
export function costLine(item: ProgramItem): string {
  const who = item.partner && item.role ? `${ROLE_LABEL[item.role]}: ${item.partner.name} · ` : "";
  const unit = item.sessions === 1 ? item.unit : `${item.unit}s`;
  return `${who}${item.sessions} ${unit} × ${usd(item.unitCost)}`;
}

// A kept institution from the draft runs the item; the Qloo place hosts it.
export function runWith(item: ProgramItem, institution: string) {
  item.runWith = institution;
  const p = item.partner?.name;
  if (item.bucket === "training" && p) item.title = `Trades-training info night, run with ${institution}, hosted at ${p}`;
  else if (item.bucket === "procurement" && p) item.title = `Supplier day: ${p}, run with ${institution}`;
  else item.title = `${item.title}, run with ${institution}`;
}
