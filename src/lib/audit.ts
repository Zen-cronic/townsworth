import type { QlooEntity } from "./qloo";
import type { TownProfile } from "./profile";
import { haversineKm, SEARCH_RADIUS_KM } from "./geo";
import { cleanName, OPEN_GRANT_ID, type Bucket, type ProgramItem } from "./plan";
import { isInstitution, namedPartner } from "./baselineData";

// The audit verdict is deterministic. A model may help extract a named partner from free text,
// but only these rules decide whether an item is grounded in the town.

// grounded: a verified local partner, a distinct local signal, or a line naming the host community
//   (the town, its county, or a municipality within about 25 km).
// institution: names a real-sounding institution (EDC, district, college...) that Qloo and OSM can't
//   confirm. Kept, never struck: absence from a places list is not evidence it doesn't exist.
// mechanism: a commitment or process rather than a single event (grant panel, purchasing target,
//   local-hire target, apprenticeship pipeline, listening sessions), or in-kind help. Kept as drafted.
// generic / unverified: struck.
export type Verdict = "grounded" | "institution" | "mechanism" | "generic" | "unverified";

export const isKept = (v: Verdict) => v === "grounded" || v === "institution" || v === "mechanism";

export interface AuditInput {
  text: string;
  named?: string | null;
  // Pre-computed OpenStreetMap check for the named partner (frozen with the baseline).
  osm?: { found: boolean; osmName?: string; km?: number } | null;
  // /check only: a Qloo name search for the named partner near the site that passed matchSearchHit.
  qloo?: { name: string; km: number } | null;
}

// Why a kept line was kept, for display. `keptLabel` is the short name, `keptNote` one plain clause.
export type KeptAs = "partner" | "signal" | "host" | "institution" | "mechanism" | "in-kind";

export interface AuditRow {
  text: string;
  // The partner the draft names, after null/"none" cleanup.
  named?: string;
  bucket: Bucket;
  verdict: Verdict;
  reasons: string[];
  matched?: { name: string; distanceKm?: number; source: "qloo" | "osm" | "qloo-search" };
  termHits: string[];
  // Struck lines: the like-for-like Qloo item that replaces it.
  replacement?: ProgramItem;
  // Kept institutions: a Qloo item added next to it, not instead of it.
  alongside?: ProgramItem;
  // Kept grant mechanisms: Qloo's grant candidates, as suggested applicants.
  applicants?: ProgramItem[];
  keptAs?: KeptAs;
  keptLabel?: string;
  keptNote?: string;
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
  // "school" alone doesn't make a line a grant: school supply drives and school visits are not grants.
  ["grants", /grant|donat|fund|library|park|food bank|nonprofit|museum|tree/i],
];

function bucketOf(text: string): Bucket {
  return BUCKET_RULES.find(([, re]) => re.test(text))?.[0] ?? "grants";
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const tokens = (s: string) => norm(s).split(" ").filter((t) => t.length > 2);

// Share of name tokens two names have in common, over the longer name's token count.
function nameOverlap(named: string, candidate: string): number {
  const want = new Set(tokens(named));
  const have = new Set(tokens(candidate));
  return [...have].filter((t) => want.has(t)).length / Math.max(have.size, want.size, 1);
}

// Partners are matched only against Qloo places within the radius (never national taste brands),
// by exact name or at least 60% token overlap. No substring test: "Art Museum" is not every museum.
export function findPartner(named: string, profile: TownProfile): QlooEntity | undefined {
  const target = norm(named);
  const want = new Set(tokens(named));
  if (!target || !want.size) return undefined;
  let best: { e: QlooEntity; score: number } | undefined;
  for (const e of profile.places) {
    const name = norm(cleanName(e.name));
    if (name === target) return e;
    const overlap = nameOverlap(named, cleanName(e.name));
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
export function osmVerifies(named: string, osmName: string | undefined, townName: string): boolean {
  if (!osmName) return true;
  const townWords = new Set(tokens(townName));
  const distinctive = (s: string) => new Set(tokens(s).filter((t) => !FORM_WORDS.has(t) && !townWords.has(t)));
  const a = distinctive(named);
  if (!a.size) return norm(named) === norm(osmName);
  const b = distinctive(osmName);
  return [...a].some((t) => b.has(t));
}

// A Qloo /search hit verifies a named partner only when it is the same place near the site: within
// 25 km, sharing a distinctive name word (the OpenStreetMap rule), at least 60% name-token overlap
// (the Qloo-places rule), and adding no distinctive word of its own, so "Racine Zoo Beach" doesn't
// verify "Racine Zoo". The hit's own city and suffixes such as "campus" don't count as new words.
export { SEARCH_RADIUS_KM };
const NEUTRAL_SUFFIX = new Set("campus branch location main downtown north south east west inc llc ltd".split(" "));

export function matchSearchHit(
  named: string,
  hits: QlooEntity[],
  town: { name: string; lat: number; lon: number },
): { name: string; km: number } | null {
  const townWords = new Set(tokens(town.name));
  const own = new Set(tokens(named));
  let best: { name: string; km: number; score: number } | null = null;
  for (const e of hits) {
    if (!e.location) continue;
    const name = cleanName(e.name);
    const km = Math.round(haversineKm(town, e.location) * 10) / 10;
    if (km > SEARCH_RADIUS_KM || !osmVerifies(named, name, town.name)) continue;
    const exact = norm(name) === norm(named);
    const score = exact ? 2 : nameOverlap(named, name);
    if (score < 0.6) continue;
    const cityWords = new Set([...tokens(e.city ?? ""), ...tokens(addressCity(e.address) ?? "")]);
    const extra = tokens(name).filter((t) => !own.has(t) && !FORM_WORDS.has(t) && !townWords.has(t) && !cityWords.has(t) && !NEUTRAL_SUFFIX.has(t));
    if (!exact && extra.length) continue;
    if (!best || score > best.score || (score === best.score && km < best.km)) best = { name, km, score };
  }
  return best && { name: best.name, km: best.km };
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

// Mechanisms: commitments and processes, not single events. Each keeps its own bucket, so the
// program's matching local items are added alongside, never swapped in for it.
type MechanismKind = "grants" | "procurement" | "local-hire" | "apprenticeship" | "engagement";

const MECHANISM: Record<MechanismKind, { bucket: Bucket; label: string; note: string }> = {
  grants: { bucket: "grants", label: "grant mechanism", note: "how grants are decided stays as drafted" },
  procurement: { bucket: "procurement", label: "local purchasing commitment", note: "the purchasing commitment stays as drafted" },
  "local-hire": { bucket: "training", label: "local-hire commitment", note: "the hiring commitment stays as drafted" },
  apprenticeship: { bucket: "training", label: "apprenticeship pipeline", note: "the pipeline stays as drafted" },
  engagement: { bucket: "channels", label: "community engagement", note: "how residents are heard stays as drafted" },
};

const PROCUREMENT_MECHANISM = [
  /\b(purchasing|procurement|spend|spending|sourcing)\b[^.;]*\b(targets?|goals?|share|scorecards?|registry|portal|preferences?|polic(y|ies)|programs?)\b/i,
  /\b(supplier|vendor)[- ](development|diversity|registry|registries|portal|onboarding|lists?|programs?)\b/i,
  /\b(certified|diverse|minority[- ]owned|women[- ]owned) (vendors?|suppliers?|businesses)\b/i,
  // A spend share: "source 15% of catering from area vendors".
  /\b(source|sourcing|buy|purchas\w*|procure\w*|spend\w*|contracts?)\b[^.;]*\d+\s?%|\d+\s?%[^.;]*\b(spend\w*|purchas\w*|procure\w*|vendors?|suppliers?|contracts?)\b/i,
];
const LOCAL_HIRE = /\b(local[- ]hir(e|es|ing)|hire locally|priority hiring|hiring (targets?|goals?|preferences?)|first[- ]source hiring)\b/i;
// A named "workforce pipeline" alone is a label, not a mechanism: it needs apprenticeship slots,
// seats or placements behind it.
const APPRENTICESHIP = [
  /\b(pre-?apprenticeships?|apprenticeships?)\b[^.;]*\b(pipelines?|pathways?|programs?|slots?|seats?|funds?|cohorts?|placements?)\b/i,
  /\b(pipelines?|pathways?)\b[^.;]*\b(pre-?apprenticeships?|apprenticeships?)\b/i,
];
const ENGAGEMENT =
  /\b(listening sessions?|advisory (panels?|committees?|boards?|councils?)|follow-up logs?|published logs?|bilingual|multilingual|spanish-language|public scorecards?|office hours|public dashboard|feedback sessions?)\b/i;
// An open house counts when it is two-way, not a one-off tour.
const OPEN_HOUSE = /\bopen[- ]houses?\b/i;
const TWO_WAY = /\b(listening|questions|feedback|follow-up|updates|office hours)\b/i;

function mechanismOf(text: string): MechanismKind | undefined {
  if (GRANTS.test(text) && GRANT_MECHANISM.test(text)) return "grants";
  if (PROCUREMENT_MECHANISM.some((re) => re.test(text))) return "procurement";
  if (LOCAL_HIRE.test(text)) return "local-hire";
  if (APPRENTICESHIP.some((re) => re.test(text))) return "apprenticeship";
  if (ENGAGEMENT.test(text) || (OPEN_HOUSE.test(text) && TWO_WAY.test(text))) return "engagement";
  return undefined;
}

// In-kind help: staff time, volunteering, donated equipment, mentoring. Never costed from the fund,
// so never swapped for a costed grant. Checked before the bucket rules ("school supply drives").
const IN_KIND =
  /\b(volunteer (programs?|days?|hours|time|shifts?|events?)|employee[- ]volunteer\w*|volunteering|paid (volunteer )?hours|staff time|in[- ]kind|pro[- ]bono|donat(e|ed|es|ing) (equipment|computers?|laptops?|materials|space)|mentor(s|ing|ships?)?)\b/i;
const MENTORING = /\b(mentor\w*|job[- ]shadow\w*)\b/i;

const NOT_A_PLACE = new Set(["place", "the", "county", "city", "town", "village"]);
const ROAD_WORD = /^(st|street|ave|avenue|rd|road|dr|drive|blvd|bl|hwy|highway|ln|lane|way|pkwy|parkway|trail|trl|ct|court|pl|cir|circle|sq|square|pike|loop|ter|terrace|n|s|e|w|ne|nw|se|sw|north|south|east|west|ste|suite|unit|co|fm|us|route|rte)$/i;

// The municipality in a Qloo address ("441 Main St Racine, WI 53403" -> "Racine").
export function addressCity(address?: string): string | undefined {
  const m = address?.match(/^(.*?),\s*[A-Z]{2}\b[^,]*$/);
  if (!m) return undefined;
  const words = m[1].trim().split(/\s+/);
  const out: string[] = [];
  for (let i = words.length - 1; i >= 0 && out.length < 3; i--) {
    const w = words[i];
    if (!/^[A-Z][A-Za-z.'\u2019-]*$/.test(w) || ROAD_WORD.test(w.replace(/\.$/, ""))) break;
    out.unshift(w);
  }
  return out.length ? out.join(" ") : undefined;
}

// Jurisdiction-specific instruments and named facilities, written as proper nouns: what is left of
// "Racine County Economic Development Corporation" or "Williamson County Expo Center" once the
// place name is taken out.
const INSTRUMENT =
  /\b(ISD|EDC|(Independent )?School District|Economic Development (Corporation|Council|Partnership|Authority|Alliance)|Workforce (Board|Solutions|Development Board)|Community College|Technical College|Public Library|Chamber of Commerce|Expo(sition)? Cent(er|re)|Convention Cent(er|re)|Civic Cent(er|re)|Community Cent(er|re)|Fairgrounds|High School|Village Hall|City Hall|Town Hall|Parks and Recreation|Industrial Development Agency|Housing Authority|Transit Authority)\b/;
// A residency requirement on the host community: "residents of <county>", "who live in <town>".
const PLACE_SLOT = "\u27e8place\u27e9";
const RESIDENCY = new RegExp(`\\b(residents? of|who live in|living in|applicants from|recruit(ing)? from|hiring from) (the )?${PLACE_SLOT}`, "i");

// The template-swap test. Naming the host town is not local by itself: the plain LLM writes the
// town into almost every line. With the town, county and region names taken out, the line must
// still carry something specific to this place: a residency requirement, a jurisdiction-specific
// instrument or facility, or a local place from Qloo's list.
export function survivesTemplateSwap(text: string, mentions: string[], profile: TownProfile): boolean {
  const names = [...mentions, profile.town.region].filter(Boolean).sort((a, b) => b.length - a.length);
  let swapped = text;
  for (const n of names) swapped = swapped.replace(new RegExp(`(?<![A-Za-z])${escapeRe(n)}(?![A-Za-z])`, "g"), PLACE_SLOT);
  if (RESIDENCY.test(swapped) || INSTRUMENT.test(swapped)) return true;
  const hay = ` ${norm(swapped)} `;
  return profile.places.some((e) => {
    const n = norm(cleanName(e.name));
    return n.split(" ").length >= 2 && hay.includes(` ${n} `);
  });
}

const HOST_COMMUNITY_KM = 25;
const stripForm = (s: string) => s.trim().replace(/^(village|town|city|township|municipality) of /i, "");

// The host town and the municipalities around it (within about 25 km), from the town record and
// the cities and addresses of the Qloo places near the site.
export function hostCommunityNames(profile: TownProfile): string[] {
  const names = new Set<string>();
  const add = (raw?: string) => {
    const n = raw && stripForm(raw);
    if (!n || n.length < 3 || NOT_A_PLACE.has(n.toLowerCase()) || !/^[A-Z]/.test(n)) return;
    names.add(n);
    if (/^Mount /.test(n)) names.add(n.replace(/^Mount /, "Mt. ")).add(n.replace(/^Mount /, "Mt "));
    if (/^Mt\.? /.test(n)) names.add(n.replace(/^Mt\.? /, "Mount "));
  };
  add(profile.town.name);
  for (const e of profile.places) {
    if ((e.distanceM ?? 0) > HOST_COMMUNITY_KM * 1000) continue;
    add(profile.placeMeta.get(e.id)?.city);
    add(e.city);
    add(addressCity(e.address));
  }
  return [...names];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Host-community names the line mentions, in reading order, then the counties it names when they
// belong to the host community: "<host municipality> County", or any county named next to one.
export function hostMentions(text: string, names: string[]): string[] {
  const counties: { name: string; at: number }[] = [];
  const all = [...text.matchAll(/\b((?:St\. )?[A-Z][a-z]+) County\b/g)];
  const countyAt = new Set(all.map((m) => m.index ?? -1));
  const found: { name: string; at: number }[] = [];
  // Longest names first, so "Mount Pleasant" wins over "Pleasant"; a name inside a county ("Racine"
  // in "Racine County") counts as the county only.
  for (const n of [...names].sort((x, y) => y.length - x.length)) {
    for (const m of text.matchAll(new RegExp(`(?<![A-Za-z])${escapeRe(n)}(?![A-Za-z])`, "g"))) {
      const at = m.index ?? 0;
      if (countyAt.has(at) && text.startsWith(`${n} County`, at)) continue;
      if (found.some((f) => at >= f.at && at < f.at + f.name.length)) continue;
      if (!found.some((f) => f.name === n)) found.push({ name: n, at });
    }
  }
  for (const m of all) {
    const base = m[1];
    if ((names.includes(base) || found.length) && !counties.some((c) => c.name === m[0])) counties.push({ name: m[0], at: m.index ?? 0 });
  }
  return [...found.sort((a, b) => a.at - b.at), ...counties.sort((a, b) => a.at - b.at)].map((x) => x.name);
}

const norm1 = (s: string) => ` ${norm(s)} `;

export function auditPlan(inputs: AuditInput[], profile: TownProfile, program: ProgramItem[]): AuditRow[] {
  const used = new Set<string>();
  const townName = profile.town.name;
  const community = hostCommunityNames(profile);
  // Like-for-like swaps and additions come from Qloo-picked items, never the open grant cycle.
  const nextInBucket = (bucket: Bucket) => {
    const item = program.find((p) => p.bucket === bucket && p.id !== OPEN_GRANT_ID && !used.has(p.id));
    if (item) used.add(item.id);
    return item;
  };
  const grantCandidates = program.filter((p) => p.bucket === "grants" && p.partner);

  return inputs.map(({ text, named: rawNamed, osm, qloo }) => {
    const mechanism = mechanismOf(text);
    const inKind = !mechanism && IN_KIND.test(text);
    const bucket: Bucket = mechanism ? MECHANISM[mechanism].bucket : inKind ? (MENTORING.test(text) ? "training" : "events") : bucketOf(text);
    const reasons: string[] = [];
    const hits = termHits(text, profile.themeVocabulary);
    const host = hostMentions(text, community);
    let named = namedPartner(rawNamed);
    // The host town itself is not a partner ("Kincardine" for an event in Kincardine).
    if (named && norm(named) === norm(townName)) named = undefined;
    let verdict: Verdict;
    let matched: AuditRow["matched"];
    let keptAs: KeptAs | undefined;
    let keptLabel: string | undefined;
    let keptNote: string | undefined;
    let partnerUnconfirmed = false;

    if (named) {
      const found = findPartner(named, profile);
      if (found) {
        matched = { name: cleanName(found.name), distanceKm: km1(found.distanceM), source: "qloo" };
        verdict = "grounded";
        keptAs = "partner";
        reasons.push(`"${named}" matches a local place in Qloo's data, within 15 km`);
      } else if (osm?.found && osmVerifies(named, osm.osmName, townName)) {
        matched = { name: osm.osmName ?? named, distanceKm: osm.km, source: "osm" };
        verdict = "grounded";
        keptAs = "partner";
        reasons.push(`"${named}" is a real local organisation (found on OpenStreetMap${osm.km != null ? `, ${osm.km} km away` : ""})`);
      } else if (qloo) {
        matched = { name: qloo.name, distanceKm: qloo.km, source: "qloo-search" };
        verdict = "grounded";
        keptAs = "partner";
        reasons.push(`Qloo knows this place · ${qloo.km} km`);
      } else if (isInstitution(named)) {
        verdict = "institution";
        keptAs = "institution";
        reasons.push(`"${named}" looks like a local institution that Qloo and OpenStreetMap can't confirm here. Kept: confirm with the committee`);
      } else {
        partnerUnconfirmed = true;
        verdict = "unverified";
        // A partner the draft attaches to a line that never mentions it is reported as such.
        reasons.push(
          norm1(text).includes(norm1(named))
            ? `"${named}" was not found among Qloo's local places or on OpenStreetMap. It may exist, but it can't be verified here`
            : `The draft names "${named}" as partner, not found locally`,
        );
      }
    } else {
      verdict = "generic";
    }

    // A line with no confirmed partner: mechanisms and in-kind help are kept as drafted whatever the
    // partner; otherwise a distinct local signal or a host-community mention keeps it.
    const hostReason = host.length ? `Names the host community (${host.join(", ")})` : undefined;
    if (!keptAs) {
      if (hostReason && (mechanism || inKind)) reasons.push(hostReason);
      if (mechanism) {
        verdict = "mechanism";
        keptAs = "mechanism";
        ({ label: keptLabel, note: keptNote } = MECHANISM[mechanism]);
        if (mechanism === "grants") reasons.push("Describes how grants are decided, not who gets them. Kept; Qloo suggests applicants");
      } else if (inKind) {
        verdict = "mechanism";
        keptAs = "in-kind";
        keptLabel = "in-kind (not costed)";
        keptNote = "staff time and donated help stay in-kind; the fund doesn't pay for them";
        reasons.push("In-kind help (staff time, volunteering, equipment or mentoring): kept as in-kind, not costed and never swapped for a grant");
      } else if (!partnerUnconfirmed && hits.length >= 1) {
        verdict = "grounded";
        keptAs = "signal";
        reasons.push(`Matches a distinct local signal: ${hits.join("; ")}`);
      } else if (!partnerUnconfirmed && host.length && survivesTemplateSwap(text, host, profile)) {
        verdict = "grounded";
        keptAs = "host";
        keptLabel = "names the host community";
        keptNote = host.join(", ");
        reasons.push(hostReason!);
      } else if (!partnerUnconfirmed) {
        reasons.push(
          host.length
            ? "Names the town but would fit any town with the name swapped: no local partner, mechanism or local instrument"
            : "Names no local partner and matches nothing this town stands out for",
        );
      }
    }
    if (hostReason && !reasons.includes(hostReason) && isKept(verdict)) reasons.push(hostReason);

    const row: AuditRow = { text, named, bucket, verdict, reasons, matched, termHits: hits, keptAs, keptLabel, keptNote };
    // Like-for-like only: a swap from another bucket would be a misleading pairing.
    if (verdict === "generic" || verdict === "unverified") row.replacement = nextInBucket(bucket);
    else if (verdict === "institution") row.alongside = nextInBucket(bucket);
    else if (keptAs === "mechanism") {
      if (mechanism === "grants") row.applicants = grantCandidates;
      else {
        row.alongside = nextInBucket(bucket);
        const a = /^[aeiou]/i.test(keptLabel ?? "") ? "An" : "A";
        reasons.push(
          `${a} ${keptLabel}, not a single event: kept as drafted${row.alongside ? ", with the program's matching local item added alongside" : ""}`,
        );
      }
    }
    return row;
  });
}
