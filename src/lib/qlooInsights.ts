import type { QlooEntity } from "./qloo";
import { NON_SIGNAL_TAG_TYPES } from "./filters";

// Optional Qloo data that sits beside the program and never feeds it: the audience age profile of
// each partner (urn:demographics) and the place traits the area over-indexes on (urn:tag with
// signal.location). Pure parsers and helpers only, so client components can label the data too.
// None of it is read by buildProgram, auditPlan or applyReach.

// Qloo's six age buckets, in order. Gender comes back in the same answer and is discarded here.
export const AGE_BUCKETS = ["24_and_younger", "25_to_29", "30_to_34", "35_to_44", "45_to_54", "55_and_older"] as const;
export type AgeBucket = (typeof AGE_BUCKETS)[number];
// Affinity per bucket, from -1 to 1; above 0 means the partner's audience over-indexes on the group.
export type AgeProfile = Record<AgeBucket, number>;

export const AGE_LABEL: Record<AgeBucket, string> = {
  "24_and_younger": "under 25",
  "25_to_29": "25 to 29",
  "30_to_34": "30 to 34",
  "35_to_44": "35 to 44",
  "45_to_54": "45 to 54",
  "55_and_older": "55 and older",
};

// Below this, no bucket stands out and the profile reads as a broad mix.
export const AGE_SKEW_MIN = 0.15;

// results.demographics[] -> entity id -> age profile. A row without all six numeric age buckets is
// dropped (Qloo has no profile for that place, never a zero). Only `query.age` is read.
export function parseDemographics(body: unknown): Map<string, AgeProfile> {
  const rows = (body as { results?: { demographics?: unknown } } | null)?.results?.demographics;
  const out = new Map<string, AgeProfile>();
  if (!Array.isArray(rows)) return out;
  for (const row of rows as { entity_id?: unknown; query?: { age?: unknown } }[]) {
    const age = row?.query?.age as Record<string, unknown> | undefined;
    if (typeof row?.entity_id !== "string" || !age || typeof age !== "object") continue;
    if (!AGE_BUCKETS.every((b) => typeof age[b] === "number" && Number.isFinite(age[b]))) continue;
    out.set(row.entity_id, Object.fromEntries(AGE_BUCKETS.map((b) => [b, age[b] as number])) as AgeProfile);
  }
  return out;
}

// The group a partner's audience over-indexes on most, or "broad age mix" when none reaches 0.15.
export function ageSkewLabel(age: AgeProfile | undefined): string | undefined {
  if (!age) return undefined;
  const top = AGE_BUCKETS.reduce((best, b) => (age[b] > age[best] ? b : best), AGE_BUCKETS[0]);
  return age[top] >= AGE_SKEW_MIN ? AGE_LABEL[top] : "broad age mix";
}

// The one-line reading under the bars. Aggregate audience affinity, never visitors or residents.
export function ageLine(age: AgeProfile | undefined): string | undefined {
  const label = ageSkewLabel(age);
  if (!label) return undefined;
  return label === "broad age mix" ? "Qloo audience data: broad age mix" : `Qloo audience data: over-indexes with ${label}`;
}

export interface AreaTag {
  id: string;
  name: string;
  subtype: string;
  affinity: number;
  // Position among the kept traits, 1 first.
  rank: number;
}

// A trait the partner carries, with its place among the area's traits.
export interface SharedTrait {
  name: string;
  rank: number;
  of: number;
}

// Identity tags describe who goes somewhere (Locals, Families, Young Adults...). They are never shown
// as an area trait: the product does no identity targeting. Matched on the type, the subtype and the
// id, so a tag can't slip through on any one of them.
const IDENTITY = /customer_identity|identity|inclusivity|demographic|audience/i;
// Names that point at a group or a belief, whatever subtype they arrive under. Cuisines stay.
const SENSITIVE_NAME = /\b(lgbtq\+?|gay|lesbian|queer|trans(gender)?|black[- ]owned|women[- ]owned|minority[- ]owned|veteran[- ]owned|christian|catholic|muslim|jewish|halal|kosher|church|religio\w*|politic\w*|conservative|liberal|immigrants?)\b/i;

export function isIdentityTag(t: { id?: string; subtype?: string; types?: unknown; type?: string }): boolean {
  const fields = [t.id, t.subtype, t.type, ...(Array.isArray(t.types) ? t.types : [])].filter((x): x is string => typeof x === "string");
  return fields.some((f) => IDENTITY.test(f) || NON_SIGNAL_TAG_TYPES.has(f) || [...NON_SIGNAL_TAG_TYPES].some((n) => f.startsWith(`${n}:`)));
}

// Traits too generic to explain a pick: every town has restaurants, parks and "casual" places.
const GENERIC_TRAIT =
  /^(place|restaurant|bar|hotel|motel|shopping|tourist attraction|park|event venue|american|fast food restaurant|casual|clean|comfortable|welcoming|fun|good for groups|popular|affordable|convenient|friendly|nice|great|good)$/i;

export function isGenericTrait(name: string): boolean {
  return GENERIC_TRAIT.test(name.trim());
}

// results.tags[] -> the area's place traits in Qloo's order (highest affinity first), with identity,
// sensitive and generic tags removed before ranking, so "#k of N" counts only what is shown.
export function parseAreaTags(body: unknown): AreaTag[] {
  const raw = (body as { results?: { tags?: unknown } } | null)?.results?.tags;
  if (!Array.isArray(raw)) return [];
  const kept = (raw as { tag_id?: unknown; id?: unknown; name?: unknown; subtype?: unknown; types?: unknown; query?: { affinity?: unknown } }[])
    .map((t, i) => ({
      i,
      id: typeof t?.tag_id === "string" ? t.tag_id : typeof t?.id === "string" ? t.id : "",
      name: typeof t?.name === "string" ? t.name.trim() : "",
      subtype: typeof t?.subtype === "string" ? t.subtype : "",
      types: t?.types,
      affinity: typeof t?.query?.affinity === "number" ? t.query.affinity : 0,
    }))
    .filter((t) => t.id && t.name && !isIdentityTag(t) && !SENSITIVE_NAME.test(t.name) && !isGenericTrait(t.name));
  const seen = new Set<string>();
  return kept
    .sort((a, b) => b.affinity - a.affinity || a.i - b.i)
    .filter((t) => !seen.has(t.id) && !!seen.add(t.id))
    .map((t, k) => ({ id: t.id, name: t.name, subtype: t.subtype, affinity: t.affinity, rank: k + 1 }));
}

// The area traits this place carries, matched on tag id, best-ranked first, at most two. Only traits
// in the top half of the area's list are cited: "#29 of 37" is too weak to explain a pick.
export function sharedTraits(entity: Pick<QlooEntity, "tags">, areaTags: AreaTag[] | undefined, limit = 2): SharedTrait[] {
  if (!areaTags?.length) return [];
  const own = new Set(entity.tags.map((t) => t.id).filter((id): id is string => !!id));
  const cutoff = Math.ceil(areaTags.length / 2);
  return areaTags
    .filter((t) => own.has(t.id) && t.rank <= cutoff)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((t) => ({ name: t.name, rank: t.rank, of: areaTags.length }));
}

// "Carries Lively, #5 of 31 place traits this area over-indexes on (Qloo)". Undefined when there is
// no overlap, so nothing is shown rather than a weak reason.
export function traitLine(traits: SharedTrait[] | undefined): string | undefined {
  if (!traits?.length) return undefined;
  const of = traits[0].of;
  if (traits.length === 1) return `Carries ${traits[0].name}, #${traits[0].rank} of ${of} place traits this area over-indexes on (Qloo)`;
  const [a, b] = traits;
  return `Carries ${a.name} and ${b.name}, #${a.rank} and #${b.rank} of ${of} place traits this area over-indexes on (Qloo)`;
}
