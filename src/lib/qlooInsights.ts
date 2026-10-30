// Optional Qloo data that sits beside the program and never feeds it: the audience age profile of
// each partner (urn:demographics). Pure parsers and helpers only, so client components can label the
// data too. None of it is read by buildProgram, auditPlan or applyReach.

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

