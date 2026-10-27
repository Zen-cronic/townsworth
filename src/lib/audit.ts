import type { QlooEntity } from "./qloo";
import type { TownProfile } from "./profile";
import type { Bucket, ProgramItem } from "./plan";

// The audit verdict is deterministic. A model may help extract a named partner from free text,
// but only these rules decide whether an item is grounded in the town.

export type Verdict = "grounded" | "generic" | "unverified";

export interface AuditInput {
  text: string;
  named?: string | null;
}

export interface AuditRow {
  text: string;
  bucket: Bucket;
  verdict: Verdict;
  reasons: string[];
  matched?: { name: string; distanceKm?: number };
  termHits: string[];
  replacement?: ProgramItem;
}

export const GENERIC_AGENCY_PLAN: string[] = [
  "Sponsor a STEM summer camp for local students",
  "Host an annual community picnic at the county fairgrounds",
  "Sponsor the high school robotics team",
  "Fund a holiday lights display downtown",
  "Small-business breakfast with the chamber of commerce",
  "\"Data Center 101\" open house at the facility",
  "Donate to the regional food bank",
  "Sponsor a 5K fun run",
  "Newspaper ads about job openings",
  "Plant trees along the main road",
  "Scholarship for students entering STEM fields",
  "Jazz night in the park",
];

const BUCKET_RULES: [Bucket, RegExp][] = [
  ["training", /train|workforce|stem|career|apprentic|job|hiring|skills|robotics|scholarship|open house/i],
  ["procurement", /supplier|vendor|procure|buy local|small[- ]business|chamber|catering/i],
  ["channels", /\bads?\b|advert|billboard|newsletter|radio|newspaper|social media|campaign|announce/i],
  ["events", /festival|concert|fair|picnic|night|celebration|parade|5k|run|lights|party|event/i],
  ["grants", /grant|donat|fund|school|library|park|food bank|nonprofit|museum|tree/i],
];

function bucketOf(text: string): Bucket {
  return BUCKET_RULES.find(([, re]) => re.test(text))?.[0] ?? "grants";
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

function findPartner(named: string, profile: TownProfile): QlooEntity | undefined {
  const target = norm(named);
  if (!target) return undefined;
  const tokens = new Set(target.split(" ").filter((t) => t.length > 2));
  let best: { e: QlooEntity; score: number } | undefined;
  for (const e of [...profile.places, ...profile.taste.brand.map((s) => s.entity)]) {
    const name = norm(e.name);
    if (name === target || name.includes(target) || target.includes(name)) return e;
    const nameTokens = name.split(" ").filter((t) => t.length > 2);
    const overlap = nameTokens.filter((t) => tokens.has(t)).length / Math.max(nameTokens.length, tokens.size, 1);
    if (overlap >= 0.6 && (!best || overlap > best.score)) best = { e, score: overlap };
  }
  return best?.e;
}

// A theme only counts when the whole phrase appears in the item, and the phrase comes from
// something distinctly local (a distinct taste entity or a specific local place category).
function termHits(text: string, vocab: Map<string, string[]>): string[] {
  const hay = ` ${norm(text)} `;
  const hits: string[] = [];
  for (const [term, sources] of vocab) {
    if (hay.includes(` ${norm(term)} `)) hits.push(`${term} (${sources.slice(0, 2).join(", ")})`);
  }
  return hits.slice(0, 3);
}

export function auditPlan(inputs: AuditInput[], profile: TownProfile, program: ProgramItem[]): AuditRow[] {
  const usedReplacements = new Set<string>();
  return inputs.map(({ text, named }) => {
    const bucket = bucketOf(text);
    const reasons: string[] = [];
    const hits = termHits(text, profile.themeVocabulary);
    let verdict: Verdict;
    let matched: AuditRow["matched"];

    if (named) {
      const found = findPartner(named, profile);
      if (found) {
        matched = { name: found.name, distanceKm: found.distanceM != null ? Math.round(found.distanceM / 100) / 10 : undefined };
        verdict = "grounded";
        reasons.push(`"${named}" matches a Qloo place or brand in this town`);
      } else {
        verdict = "unverified";
        reasons.push(`"${named}" was not found among Qloo's local places or brands. It may exist, but it can't be verified here`);
      }
    } else if (hits.length >= 1) {
      verdict = "grounded";
      reasons.push(`Matches a distinct local signal: ${hits.join("; ")}`);
    } else {
      verdict = "generic";
      reasons.push("Names no local partner and matches nothing this town distinctly over-indexes on");
    }

    let replacement: ProgramItem | undefined;
    if (verdict !== "grounded") {
      // Like-for-like only: a swap from another bucket would be a misleading pairing.
      replacement = program.find((p) => p.bucket === bucket && !usedReplacements.has(p.id));
      if (replacement) usedReplacements.add(replacement.id);
    }
    return { text, bucket, verdict, reasons, matched, termHits: hits, replacement };
  });
}
