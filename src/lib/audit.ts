import type { QlooEntity } from "./qloo";
import type { TownProfile } from "./profile";
import { cleanName, type Bucket, type ProgramItem } from "./plan";
import { isInstitution, namedPartner } from "./baselineData";

// The audit verdict is deterministic. A model may help extract a named partner from free text,
// but only these rules decide whether an item is grounded in the town.

// grounded: a verified local partner or a distinct local signal.
// institution: names a real-sounding institution (EDC, district, college...) that Qloo and OSM can't
//   confirm. Kept, never struck: absence from a places list is not evidence it doesn't exist.
// mechanism: a grant-making mechanism (advisory panel, application cycle). Kept; Qloo suggests applicants.
// generic / unverified: struck.
export type Verdict = "grounded" | "institution" | "mechanism" | "generic" | "unverified";

export const isKept = (v: Verdict) => v === "grounded" || v === "institution" || v === "mechanism";

export interface AuditInput {
  text: string;
  named?: string | null;
  // Pre-computed OpenStreetMap check for the named partner (frozen with the baseline).
  osm?: { found: boolean; osmName?: string; km?: number } | null;
}

export interface AuditRow {
  text: string;
  // The partner the draft names, after null/"none" cleanup.
  named?: string;
  bucket: Bucket;
  verdict: Verdict;
  reasons: string[];
  matched?: { name: string; distanceKm?: number; source: "qloo" | "osm" };
  termHits: string[];
  // Struck lines: the like-for-like Qloo item that replaces it.
  replacement?: ProgramItem;
  // Kept institutions: a Qloo item added next to it, not instead of it.
  alongside?: ProgramItem;
  // Kept grant mechanisms: Qloo's grant candidates, as suggested applicants.
  applicants?: ProgramItem[];
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
const tokens = (s: string) => norm(s).split(" ").filter((t) => t.length > 2);

// Partners are matched only against Qloo places within the radius (never national taste brands),
// by exact name or at least 60% token overlap. No substring test: "Art Museum" is not every museum.
function findPartner(named: string, profile: TownProfile): QlooEntity | undefined {
  const target = norm(named);
  const want = new Set(tokens(named));
  if (!target || !want.size) return undefined;
  let best: { e: QlooEntity; score: number } | undefined;
  for (const e of profile.places) {
    const name = norm(cleanName(e.name));
    if (name === target) return e;
    const have = new Set(tokens(cleanName(e.name)));
    const overlap = [...have].filter((t) => want.has(t)).length / Math.max(have.size, want.size, 1);
    if (overlap >= 0.6 && (!best || overlap > best.score || (overlap === best.score && (e.distanceM ?? 1e9) < (best.e.distanceM ?? 1e9)))) {
      best = { e, score: overlap };
    }
  }
  return best?.e;
}

const FORM_WORDS = new Set("the and for village town city county township board department public community centre center hall office".split(" "));

// An OpenStreetMap hit only verifies the partner when it is the same organisation: it must share a
// distinctive name word (not the host town's name, not "village", "board"...). A settlement result
// ("Franksville" for "Village of Mount Pleasant") or a different body ("Metropolitan Water Board" for
// "Clay Town Board") doesn't count. A name with no distinctive word must match exactly.
function osmVerifies(named: string, osmName: string | undefined, townName: string): boolean {
  if (!osmName) return true;
  const townWords = new Set(tokens(townName));
  const distinctive = (s: string) => new Set(tokens(s).filter((t) => !FORM_WORDS.has(t) && !townWords.has(t)));
  const a = distinctive(named);
  if (!a.size) return norm(named) === norm(osmName);
  const b = distinctive(osmName);
  return [...a].some((t) => b.has(t));
}

// A grant-making mechanism: the line describes how grants are decided, not who gets them.
const GRANTS = /\b(grants?|micro-?grants?)\b/i;
const GRANT_MECHANISM = /\b(advisory panel|review panel|review committee|advisory committee|application|intake|decisions? (are |is )?made)\b/i;

// A theme only counts when it appears in the item as written. Multi-word themes match as a phrase;
// a one-word theme must appear capitalised (a proper noun), so "purchasing target" is not Target.
function termHits(text: string, vocab: Map<string, string[]>): string[] {
  const hay = ` ${norm(text)} `;
  const hits: string[] = [];
  for (const [term, sources] of vocab) {
    const multi = norm(term).includes(" ");
    const found = multi
      ? hay.includes(` ${norm(term)} `)
      : new RegExp(`(^|[^A-Za-z])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Za-z]|$)`).test(text) && /^[A-Z]/.test(term);
    if (found) hits.push(`${term} (${sources.slice(0, 2).join(", ")})`);
  }
  return hits.slice(0, 3);
}

const km1 = (m?: number) => (m != null ? Math.round(m / 100) / 10 : undefined);

export function auditPlan(inputs: AuditInput[], profile: TownProfile, program: ProgramItem[]): AuditRow[] {
  const used = new Set<string>();
  const townName = profile.town.name;
  const nextInBucket = (bucket: Bucket) => {
    const item = program.find((p) => p.bucket === bucket && !used.has(p.id));
    if (item) used.add(item.id);
    return item;
  };
  const grantCandidates = program.filter((p) => p.bucket === "grants");

  return inputs.map(({ text, named: rawNamed, osm }) => {
    const bucket = bucketOf(text);
    const reasons: string[] = [];
    const hits = termHits(text, profile.themeVocabulary);
    let named = namedPartner(rawNamed);
    // The host town itself is not a partner ("Kincardine" for an event in Kincardine).
    if (named && norm(named) === norm(townName)) named = undefined;
    let verdict: Verdict;
    let matched: AuditRow["matched"];

    if (named) {
      const found = findPartner(named, profile);
      if (found) {
        matched = { name: cleanName(found.name), distanceKm: km1(found.distanceM), source: "qloo" };
        verdict = "grounded";
        reasons.push(`"${named}" matches a Qloo place within 15 km`);
      } else if (osm?.found && osmVerifies(named, osm.osmName, townName)) {
        matched = { name: osm.osmName ?? named, distanceKm: osm.km, source: "osm" };
        verdict = "grounded";
        reasons.push(`"${named}" is a real local organisation (found on OpenStreetMap${osm.km != null ? `, ${osm.km} km away` : ""})`);
      } else if (isInstitution(named)) {
        verdict = "institution";
        reasons.push(`"${named}" looks like a local institution that Qloo and OpenStreetMap can't confirm here. Kept: confirm with the committee`);
      } else {
        verdict = "unverified";
        reasons.push(`"${named}" was not found among Qloo's local places or on OpenStreetMap. It may exist, but it can't be verified here`);
      }
    } else if (hits.length >= 1) {
      verdict = "grounded";
      reasons.push(`Matches a distinct local signal: ${hits.join("; ")}`);
    } else if (GRANTS.test(text) && GRANT_MECHANISM.test(text)) {
      verdict = "mechanism";
      reasons.push("Describes how grants are decided, not who gets them. Kept; Qloo suggests applicants");
    } else {
      verdict = "generic";
      reasons.push("Names no local partner and matches nothing this town distinctly over-indexes on");
    }

    const row: AuditRow = { text, named, bucket, verdict, reasons, matched, termHits: hits };
    // Like-for-like only: a swap from another bucket would be a misleading pairing.
    if (verdict === "generic" || verdict === "unverified") row.replacement = nextInBucket(bucket);
    else if (verdict === "institution") row.alongside = nextInBucket(bucket);
    else if (verdict === "mechanism") row.applicants = grantCandidates;
    return row;
  });
}
