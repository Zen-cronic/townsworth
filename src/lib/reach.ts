import type { QlooEntity } from "./qloo";
import type { TownProfile } from "./profile";
import { categories, isChain } from "./filters";
import {
  cleanName,
  costed,
  DINING,
  DINING_NAME,
  hasCategory,
  km,
  NON_GRANT_CEILING,
  partnerOf,
  placeProvenance,
  REACH_PREFIX,
  UNIT,
  usd,
  type Program,
  type ProgramItem,
} from "./plan";

// Age-group check. Qloo re-ranks the same places within 15 km for three aggregate groups; the
// program "includes" a group when one of its partners is in that group's top 15. When none is, one
// costed session is earmarked at the group's best eligible host, paid only from the reserve. No resident
// is scored: these are aggregate place affinities. Only these three lenses exist; no other
// demographic or audience parameter is ever requested.

export type LensKey = "young-adults" | "older" | "families";

export interface Lens {
  key: LensKey;
  label: string;
  // An adult-only (21+) partner, such as a brewery hosting evening sessions, doesn't count for this group.
  minorsIncluded: boolean;
  title: (place: string) => string;
  month: number;
}

export const LENSES: Lens[] = [
  { key: "young-adults", label: "young adults (under 25)", minorsIncluded: true, title: (p) => `Open evening for young adults (under 25) at ${p}`, month: 16 },
  { key: "older", label: "older residents", minorsIncluded: false, title: (p) => `Daytime open session for older residents at ${p}`, month: 4 },
  { key: "families", label: "families with young children", minorsIncluded: true, title: (p) => `Family open afternoon at ${p}`, month: 4 },
];

// The one life stage used, matched by name in Qloo's audience list at runtime.
export const PARENTS_AUDIENCE = { name: /^parents with young children$/i, idPrefix: "urn:audience:life_stage:" };

// What the profile keeps from each lens query: Qloo's top places for the group, in Qloo's order.
export interface LensData {
  key: LensKey;
  ok: boolean;
  ids: string[];
}

export type LensStatus = "covered" | "added" | "no-fit" | "no-candidate" | "unchecked";

export interface LensPlace {
  id: string;
  name: string;
  lensRank: number;
  affinityRank?: number;
  distanceKm?: number;
}

export interface LensOutcome {
  key: LensKey;
  label: string;
  status: LensStatus;
  // covered: the program partners in the group's top 15, as drafted.
  partners?: LensPlace[];
  // added / no-fit: the group's best eligible host.
  place?: LensPlace;
  itemId?: string;
  amount?: number;
  // How many places Qloo ranked for the group (0 in very thin towns).
  ranked?: number;
  note: string;
}

// Eligible hosts: halls, community centres, libraries, parks, museums, zoos, schools and colleges.
// A public beach counts as a park.
const LENS_HOST =
  /^(banquet hall|community center|civic center|cultural center|conference center|convention center|auditorium|library|public library|museum|art museum|history museum|science museum|children's museum|park|city park|state park|county park|regional park|national park|nature preserve|beach|zoo|school|high school|middle school|elementary school|college|community college|technical college|university|public university)$/i;
// Never a host for these sessions: dining, bars, gyms, clubs and farms (any category), or a place
// that is retail first (its primary category or its name). A museum that also has a gift shop stays.
const NOT_A_LENS_HOST = /bar\b|pub\b|brew|beer|winery|night club|lounge|gym|fitness|yoga|casino|hotel|motel|golf|country club|orchard|farm|petting zoo/i;
const RETAIL = /store|shop\b|market|mall|outlet|boutique|supermarket|marina/i;

export function isLensHost(e: QlooEntity): boolean {
  const cats = categories(e);
  const name = cleanName(e.name);
  if (!cats.some((c) => LENS_HOST.test(c))) return false;
  if (cats.some((c) => NOT_A_LENS_HOST.test(c)) || NOT_A_LENS_HOST.test(name)) return false;
  if ((cats[0] && RETAIL.test(cats[0])) || RETAIL.test(name)) return false;
  if (hasCategory(e, DINING) || DINING_NAME.test(name) || isChain(e.name)) return false;
  return true;
}

// Bars, pubs, breweries and wineries: the program already runs them as adult (21+) evening venues.
const ADULT_ONLY = /^(bar|pub|sports bar|brewery|brewpub|beer garden|beer hall|night club|winery|wine bar|cocktail bar|lounge|tavern)$/i;
const ADULT_NAME = /\b(bar|pub|brew\w*|beer|tavern|saloon|taproom|winery)\b/i;

export function isAdultOnly(e: QlooEntity): boolean {
  return categories(e).some((c) => ADULT_ONLY.test(c)) || ADULT_NAME.test(cleanName(e.name));
}

const SESSION = UNIT.watch;

function lensPlace(id: string, rank: number, profile: TownProfile): LensPlace {
  const e = profile.places.find((p) => p.id === id);
  const meta = profile.placeMeta.get(id);
  return { id, name: e ? cleanName(e.name) : id, lensRank: rank, affinityRank: meta?.affinityRank, distanceKm: km(e?.distanceM) };
}

// Runs after the program is costed and scaled. Sets `program.reach` (one outcome per lens) and
// `program.reachItems` (at most one `reach-` session per lens), each earmarked from the reserve:
// `program.items`, `totalAllocated` and `unassigned` are left exactly as built, so every existing
// count and the fund reconciliation (items + unassigned = 2x fund) are unchanged, and
// `reachEarmarked` never exceeds `unassigned`. Without lens data the program is left untouched.
export function applyReach(profile: TownProfile, program: Program): Program {
  if (!profile.lenses) return program;
  const outcomes: LensOutcome[] = [];
  if (profile.failedCalls.length) {
    program.reach = LENSES.map((l) => ({ key: l.key, label: l.label, status: "unchecked", note: "Qloo's place list didn't answer, so this couldn't be checked." }));
    return program;
  }
  const partnerIds = new Set(program.picks.affinity);
  const reachItems: ProgramItem[] = [];
  const earmarked = () => reachItems.reduce((s, it) => s + it.amount, 0);
  const localById = new Map(profile.localPlaces.map((e) => [e.id, e]));

  for (const lens of LENSES) {
    const data = profile.lenses.find((d) => d.key === lens.key);
    const base = { key: lens.key, label: lens.label };
    if (!data?.ok) {
      outcomes.push({ ...base, status: "unchecked", note: `Qloo didn't answer for ${lens.label}, so this couldn't be checked. Nothing was added.` });
      continue;
    }
    const counts = (id: string) => {
      if (!partnerIds.has(id)) return false;
      const e = profile.places.find((p) => p.id === id);
      return !(lens.minorsIncluded && e && isAdultOnly(e));
    };
    const covered = data.ids.flatMap((id, i) => (counts(id) ? [lensPlace(id, i + 1, profile)] : []));
    if (covered.length) {
      outcomes.push({ ...base, status: "covered", partners: covered, note: `${covered[0].name} is #${covered[0].lensRank} for ${lens.label}.` });
      continue;
    }
    // The group's best eligible host: in Qloo's local list with a local-affinity rank, a hall,
    // library, park, museum, zoo, school or college, and not already in the program.
    const best = data.ids
      .map((id, i) => ({ id, rank: i + 1, e: localById.get(id) }))
      .find((c) => c.e && profile.placeMeta.get(c.id)?.affinityRank != null && !partnerIds.has(c.id) && isLensHost(c.e));
    if (!best?.e) {
      outcomes.push({
        ...base,
        status: "no-candidate",
        ranked: data.ids.length,
        note: !data.ids.length
          ? `Qloo has no places ranked for ${lens.label} near the site (thin data), so nothing was added.`
          : `None of the ${data.ids.length} places Qloo ranks highest for ${lens.label} is a hall, library, park or beach, museum, zoo, school or college in Qloo's local list, so nothing was added.`,
      });
      continue;
    }
    const place = lensPlace(best.id, best.rank, profile);
    const nonGrant = program.items.filter((it) => it.bucket !== "grants").reduce((s, it) => s + it.amount, 0) + earmarked();
    const reserveLeft = program.unassigned - earmarked();
    if (SESSION.cost > reserveLeft || nonGrant + SESSION.cost > program.twoYearFund * NON_GRANT_CEILING) {
      outcomes.push({
        ...base,
        status: "no-fit",
        place,
        note: `A session at ${place.name} (${usd(SESSION.cost)}) doesn't fit in the reserve (${usd(Math.max(0, reserveLeft))} left), so it was skipped.`,
      });
      continue;
    }
    const e = best.e;
    const item = costed({
      id: `${REACH_PREFIX}${lens.key}`,
      bucket: "events",
      title: lens.title(place.name),
      detail: `Added so the program includes a place ${lens.label} favour (Qloo, aggregate). One open session where they already go: the jobs, grants and supplier days explained, questions taken. Earmarked from the reserve for the committee to confirm.`,
      partner: partnerOf(e, profile.placeMeta.get(e.id)),
      role: "host",
      sessions: 1,
      unitCost: SESSION.cost,
      unit: SESSION.unit,
      costBasis: SESSION.basis,
      months: [lens.month],
      provenance: [
        {
          signal: `Favoured by ${lens.label} · #${best.rank} of ${data.ids.length} (Qloo, aggregate)`,
          detail: `None of the program's partners is in Qloo's top ${data.ids.length} places within 15 km for ${lens.label}; this is the best-ranked eligible host there. Aggregate place affinities: no resident is scored.`,
        },
        ...placeProvenance(e, "Eligible host venue", profile),
      ],
    });
    reachItems.push(item);
    outcomes.push({ ...base, status: "added", place, itemId: item.id, amount: item.amount, note: `Added one session at ${place.name}, #${best.rank} for ${lens.label}.` });
  }

  program.reach = outcomes;
  program.reachItems = reachItems;
  program.reachEarmarked = earmarked();
  return program;
}

// Lens outcomes as plain counts, for /proof.
export function reachSummary(outcomes: LensOutcome[] | undefined) {
  const list = outcomes ?? [];
  return {
    lenses: list.map((o) => ({ key: o.key, label: o.label, status: o.status, place: o.place?.name, ranked: o.ranked })),
    covered: list.filter((o) => o.status === "covered").map((o) => o.key),
    added: [...new Set(list.filter((o) => o.status === "added").map((o) => o.place!.name))],
    unchecked: list.filter((o) => o.status === "unchecked").length,
  };
}

export type ReachSummary = ReturnType<typeof reachSummary>;
