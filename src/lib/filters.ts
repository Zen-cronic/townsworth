import type { QlooEntity } from "./qloo";

// SAFE_USE guard. Qloo results describe aggregate affinities. Political and religious results are
// excluded from plan items entirely. Identity and inclusivity tags are never used as signals, but a
// business that carries one (e.g. "LGBTQ+ friendly") stays eligible: excluding it would itself discriminate.

// Names and descriptions: organisations that are political or religious by nature.
const POLITICAL_ORG = /\b(political party|campaign committee|super pac|republican party|democratic party|conservative party|liberal party)\b/i;
const RELIGIOUS_ORG = /\b(church|ministr(y|ies)|mosque|synagogue|temple|parish|cathedral|chapel|bible|congregation)\b/i;
// Genre tags: content that is political or religious by format (podcasts and TV).
const POLITICAL_GENRE = /^(politics|political|political commentary|political news|conservative|liberal|government)$/i;
const RELIGIOUS_GENRE = /^(religion|religious|christian|christianity|spirituality|faith|gospel|christian podcasts?)$/i;
const RELIGIOUS_CATEGORY = /^(church|place of worship|mosque|synagogue|hindu temple|buddhist temple|religious organization)$/i;
const EXPLICIT = /\b(bitch|pussy|fuck\w*|shit\w*|porn\w*|xxx)\b/i;

export const NON_SIGNAL_TAG_TYPES = new Set([
  "urn:tag:inclusivity:place",
  "urn:tag:customer_identity:qloo",
  "urn:tag:payments:place",
  "urn:tag:parking:place",
]);

export type ExclusionReason = "political" | "religious" | "explicit" | "closed" | "type-noise";

export function signalTags(e: QlooEntity) {
  return e.tags.filter((t) => !t.type || !NON_SIGNAL_TAG_TYPES.has(t.type));
}

export function exclusionReason(e: QlooEntity): ExclusionReason | null {
  const tags = signalTags(e).map((t) => t.name);
  const tagText = tags.join(" | ");
  const orgText = `${e.name} | ${e.description ?? ""}`;
  if (e.isClosed) return "closed";
  if (EXPLICIT.test(e.name)) return "explicit";
  if (POLITICAL_ORG.test(orgText)) return "political";
  if (RELIGIOUS_ORG.test(e.name) || (e.type === "place" && categories(e).some((c) => RELIGIOUS_CATEGORY.test(c)))) return "religious";
  if (e.type === "podcast" || e.type === "tv_show") {
    if (tags.some((t) => POLITICAL_GENRE.test(t))) return "political";
    if (tags.some((t) => RELIGIOUS_GENRE.test(t))) return "religious";
  }
  if (e.type === "artist" && /sports organization|national football league|national hockey league|national basketball association/i.test(tagText)) {
    return "type-noise";
  }
  return null;
}

export function splitSafe(entities: QlooEntity[]) {
  const kept: QlooEntity[] = [];
  const excluded: { entity: QlooEntity; reason: ExclusionReason }[] = [];
  for (const e of entities) {
    const reason = exclusionReason(e);
    if (reason) excluded.push({ entity: e, reason });
    else kept.push(e);
  }
  return { kept, excluded };
}

export function categories(e: QlooEntity): string[] {
  return e.tags.filter((t) => t.type === "urn:tag:category:place" || t.type === "urn:tag:genre:place").map((t) => t.name);
}

// Chains and big-box retail are not local partners.
const CHAINS = /\b(walmart|target|costco|sam'?s club|chick-fil-a|mcdonald'?s|starbucks|subway|wendy'?s|burger king|taco bell|dunkin|applebee'?s|olive garden|texas roadhouse|culver'?s|denny'?s|ihop|red robin|buffalo wild wings|chili'?s|outback|home depot|lowe'?s|menards|best buy|cvs|walgreens|kroger|meijer|aldi|dollar general|dollar tree|pilot travel|love'?s travel|waffle house|cracker barrel|panera|chipotle|kfc|domino'?s|pizza hut|papa john'?s|marriott|hilton|holiday inn|best western|hampton inn|delta hotels|hyatt|sheraton|tim hortons|canadian tire|giant tiger|marcus theatres?|marcus renaissance|amc|regal|cinemark|kohl'?s|jcpenney|macy'?s|ulta|old navy|longhorn steakhouse|golden corral|dairy queen|kona grill|condado tacos|j\. alexander'?s|corelife|tully'?s|godfather'?s pizza|cheesecake factory|red lobster|bob evans|perkins|5 guys|five guys|jimmy john'?s|jersey mike'?s|arby'?s|sonic|popeyes|raising cane'?s|culver'?s|ruth'?s chris|bjs restaurant|buca di beppo|hooters|twin peaks|abuelo'?s|harvey'?s|east side mario'?s|boston pizza|the keg|swiss chalet|kelsey'?s|montana'?s|a&w)\b/i;
const NON_LOCAL_CATEGORY = /^(fast food restaurant|department store|shopping mall|hotel|resort hotel|motel|warehouse store|discount store|supermarket|convenience store|electronics store|furniture store|appliance store|mattress store|casino|casino hotel|airport|haunted house|amusement park|amusement center|video arcade|skydiving center|night club|adult entertainment|gas station|truck stop)$/i;

export function isLocalPartner(e: QlooEntity): boolean {
  if (CHAINS.test(e.name) || /haunted|skydiv/i.test(e.name)) return false;
  return !categories(e).some((c) => NON_LOCAL_CATEGORY.test(c));
}
