// Preset host communities. Coordinates are town centres; projects are from public reporting.
// Fund figures are illustrative defaults the user is expected to replace with their own commitments.

export interface Town {
  slug: string;
  name: string;
  region: string;
  country: "United States" | "Canada";
  lat: number;
  lon: number;
  project: string;
  // Who funds the community program, as named in `project` (public reporting) or typed by the user.
  sponsor: string;
  // "reported": named in public reporting; "entered": typed by the user; "placeholder": not entered yet.
  sponsorSource: "reported" | "entered" | "placeholder";
  facility: "data center" | "fab" | "nuclear" | "plant";
  defaultAnnualFund: number;
  fundNote: string;
  thinData?: boolean;
  // A town the user typed in (encoded in the slug), not one of the presets.
  custom?: boolean;
}

export const TOWNS: Town[] = [
  {
    slug: "mount-pleasant-wi",
    name: "Mount Pleasant",
    region: "Wisconsin",
    country: "United States",
    lat: 42.7117,
    lon: -87.8836,
    project: "Hyperscale AI data center campus (Microsoft, per public reporting)",
    sponsor: "Microsoft",
    sponsorSource: "reported",
    facility: "data center",
    defaultAnnualFund: 2_000_000,
    fundNote: "Illustrative. Replace with your actual community fund.",
  },
  {
    slug: "clay-ny",
    name: "Clay",
    region: "New York",
    country: "United States",
    lat: 43.1857,
    lon: -76.1724,
    project: "Semiconductor megafab (Micron, per public reporting)",
    sponsor: "Micron",
    sponsorSource: "reported",
    facility: "fab",
    defaultAnnualFund: 25_000_000,
    fundNote: "Micron and partners committed $500M over 20 years (≈$25M/yr), per Empire State Development.",
  },
  {
    slug: "new-albany-oh",
    name: "New Albany",
    region: "Ohio",
    country: "United States",
    lat: 40.0804,
    lon: -82.7842,
    project: "Data center cluster and chip fab (Meta, Google, AWS, Intel, per public reporting)",
    sponsor: "Meta, Google, AWS and Intel",
    sponsorSource: "reported",
    facility: "data center",
    defaultAnnualFund: 1_500_000,
    fundNote: "Illustrative. Meta reports $5.6M+ given locally to date.",
  },
  {
    slug: "abilene-tx",
    name: "Abilene",
    region: "Texas",
    country: "United States",
    lat: 32.4553,
    lon: -99.7385,
    project: "AI data center campus (Stargate, per public reporting)",
    sponsor: "Stargate",
    sponsorSource: "reported",
    facility: "data center",
    defaultAnnualFund: 2_000_000,
    fundNote: "Illustrative. Replace with your actual community fund.",
  },
  {
    slug: "kincardine-on",
    name: "Kincardine",
    region: "Ontario",
    country: "Canada",
    lat: 44.1767,
    lon: -81.6367,
    project: "Nuclear generating station (Bruce Power, per public reporting)",
    sponsor: "Bruce Power",
    sponsorSource: "reported",
    facility: "nuclear",
    defaultAnnualFund: 2_000_000,
    fundNote: "Bruce Power reports CAD $2M+ a year in community giving.",
  },
  {
    slug: "kemmerer-wy",
    name: "Kemmerer",
    region: "Wyoming",
    country: "United States",
    lat: 41.7761,
    lon: -110.5555,
    project: "Advanced nuclear plant (TerraPower Natrium, per public reporting)",
    sponsor: "TerraPower",
    sponsorSource: "reported",
    facility: "nuclear",
    defaultAnnualFund: 500_000,
    fundNote: "Illustrative. A thin-data host: expect fewer grounded picks.",
    thinData: true,
  },
];

export const HERO_TOWN = TOWNS[0];

// Custom towns: everything a route needs is encoded in the slug, so no server state is kept.
// Format: <Name-With-Hyphens>-<REGION>~<lat>_<lon>~<facility>[~<Company-With-Hyphens>],
// e.g. Taylor-TX~30.5729_-97.4141~fab or Taylor-TX~30.5729_-97.4141~fab~Samsung. No company means
// drafts are signed "[Your company]" until the user enters one.

export const SPONSOR_PLACEHOLDER = "[Your company]";

export const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

export const CA_PROVINCES: Record<string, string> = {
  AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick", NL: "Newfoundland and Labrador",
  NS: "Nova Scotia", NT: "Northwest Territories", NU: "Nunavut", ON: "Ontario", PE: "Prince Edward Island",
  QC: "Quebec", SK: "Saskatchewan", YT: "Yukon",
};

export const FACILITY_CODES = {
  "data-center": "data center",
  fab: "fab",
  nuclear: "nuclear",
  plant: "plant",
} as const satisfies Record<string, Town["facility"]>;

export type FacilityCode = keyof typeof FACILITY_CODES;

export const FACILITY_CHOICES: { code: FacilityCode; label: string }[] = [
  { code: "data-center", label: "Data center" },
  { code: "fab", label: "Chip fab" },
  { code: "nuclear", label: "Nuclear plant" },
  { code: "plant", label: "Factory" },
];

const FACILITY_PROJECT: Record<FacilityCode, string> = {
  "data-center": "Data center",
  fab: "Chip fab",
  nuclear: "Nuclear plant",
  plant: "Factory",
};

// Generous boxes around each country; a point outside them is not a US or Canadian town.
const BOUNDS: Record<Town["country"], { lat: [number, number]; lon: [number, number] }> = {
  "United States": { lat: [18.5, 71.6], lon: [-180, -66.8] },
  Canada: { lat: [41.6, 83.2], lon: [-141.1, -52.5] },
};

export const isFacilityCode = (v: unknown): v is FacilityCode => typeof v === "string" && v in FACILITY_CODES;

function regionFor(code: string): { region: string; country: Town["country"] } | undefined {
  const c = code.toUpperCase();
  if (US_STATES[c]) return { region: US_STATES[c], country: "United States" };
  if (CA_PROVINCES[c]) return { region: CA_PROVINCES[c], country: "Canada" };
  return undefined;
}

export function inCountry(country: Town["country"], lat: number, lon: number) {
  const b = BOUNDS[country];
  return lat >= b.lat[0] && lat <= b.lat[1] && lon >= b.lon[0] && lon <= b.lon[1];
}

// "St. Thomas" -> "St.-Thomas"; accents and apostrophes are dropped so the slug stays URL-safe.
function nameToken(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['\u2019]/g, "")
    .replace(/[^A-Za-z0-9.]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .replace(/-{2,}/g, "-");
}

// A company name as typed: letters, digits, spaces and light punctuation, at most 40 characters.
export function cleanCompany(raw: string | undefined) {
  return nameToken((raw ?? "").replace(/&/g, " and ").slice(0, 60))
    .slice(0, 40)
    .replace(/[-.]+$/g, "")
    .replace(/-/g, " ")
    .trim();
}

export function customSlug(name: string, regionCode: string, lat: number, lon: number, facility: FacilityCode, company?: string): string {
  const co = cleanCompany(company);
  return `${nameToken(name)}-${regionCode.toUpperCase()}~${lat.toFixed(4)}_${lon.toFixed(4)}~${facility}${co ? `~${nameToken(co)}` : ""}`;
}

const CUSTOM_SLUG = /^([A-Za-z0-9.]+(?:-[A-Za-z0-9.]+)*)-([A-Za-z]{2})~(-?\d{1,2}(?:\.\d{1,6})?)_(-?\d{1,3}(?:\.\d{1,6})?)~(data-center|fab|nuclear|plant)(?:~([A-Za-z0-9.]+(?:-[A-Za-z0-9.]+)*))?$/;

export function parseCustomSlug(slug: string): Town | undefined {
  if (slug.length > 170) return undefined;
  const m = CUSTOM_SLUG.exec(slug);
  if (!m) return undefined;
  const [, token, code, latRaw, lonRaw, facilityCode, companyToken] = m;
  const place = regionFor(code);
  const name = token.replace(/-/g, " ").trim();
  if (!place || name.length < 2 || name.length > 60 || !/[A-Za-z]/.test(name)) return undefined;
  const lat = Number(latRaw);
  const lon = Number(lonRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inCountry(place.country, lat, lon)) return undefined;
  const facility = facilityCode as FacilityCode;
  const company = cleanCompany(companyToken);
  if (companyToken && !company) return undefined;
  return {
    slug: customSlug(name, code, lat, lon, facility, company),
    name,
    region: place.region,
    country: place.country,
    lat,
    lon,
    project: company ? `${FACILITY_PROJECT[facility]} project (${company}, entered by you)` : `${FACILITY_PROJECT[facility]} project (entered by you; company not entered)`,
    sponsor: company || SPONSOR_PLACEHOLDER,
    sponsorSource: company ? "entered" : "placeholder",
    facility: FACILITY_CODES[facility],
    defaultAnnualFund: 1_000_000,
    fundNote: "Illustrative default for a town you entered. Replace with your actual community fund.",
    custom: true,
  };
}

// Adds (or replaces) the company segment on a custom slug. Preset slugs are returned unchanged.
export function withCompany(slug: string, company: string | undefined): string {
  const m = CUSTOM_SLUG.exec(slug);
  if (!m || !parseCustomSlug(slug)) return slug;
  const base = m[6] ? slug.slice(0, -(m[6].length + 1)) : slug;
  const co = cleanCompany(company);
  return co ? `${base}~${nameToken(co)}` : base;
}

// A preset within ~10 km of a point, so a typed-in preset town keeps its frozen LLM plan.
export function presetNear(lat: number, lon: number, km = 10): Town | undefined {
  return TOWNS.find((t) => Math.hypot((t.lat - lat) * 110.57, (t.lon - lon) * 111.32 * Math.cos((lat * Math.PI) / 180)) <= km);
}

export function townBySlug(slug: string): Town | undefined {
  return TOWNS.find((t) => t.slug === slug) ?? parseCustomSlug(slug);
}

// Sponsor disclosure. Every outreach draft and the resident ballot name the funder.

const FACILITY_NOUN: Record<Town["facility"], string> = {
  "data center": "data center",
  fab: "chip fab",
  nuclear: "nuclear plant",
  plant: "plant",
};

// "Meta, Google, AWS and Intel" -> ["Meta", "Google", "AWS", "Intel"].
export function sponsorNames(sponsor: string): string[] {
  return sponsor
    .split(/\s*,\s*|\s+and\s+|\s*&\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

// The line every draft must end with, e.g. "Sent on behalf of Microsoft's Mount Pleasant data center team".
export function sponsorSignature(town: Pick<Town, "name" | "facility" | "sponsor">): string {
  const team = `${town.name} ${FACILITY_NOUN[town.facility]} team`;
  return sponsorNames(town.sponsor).length > 1 ? `Sent on behalf of the ${team} (${town.sponsor})` : `Sent on behalf of ${town.sponsor}'s ${team}`;
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9[\]]+/g, " ").trim();

// True when every sponsor name appears in the text (case- and punctuation-insensitive).
export function namesSponsor(text: string, sponsor: string): boolean {
  const hay = ` ${squash(text)} `;
  return sponsorNames(sponsor).every((n) => hay.includes(` ${squash(n)} `));
}

// The ballot's disclosure line.
export function fundedByLine(town: Pick<Town, "sponsor" | "sponsorSource">): string {
  if (town.sponsorSource === "reported") return `Funded by ${town.sponsor} (per public reporting)`;
  if (town.sponsorSource === "entered") return `Funded by ${town.sponsor} (as entered by the organizer)`;
  return `Funded by ${SPONSOR_PLACEHOLDER} (not entered yet)`;
}

// Where to fill in the company for a typed town.
export function companyFormHref(town: Pick<Town, "name" | "region" | "facility">): string {
  const code = Object.entries({ ...US_STATES, ...CA_PROVINCES }).find(([, n]) => n === town.region)?.[0] ?? "";
  const fac = (Object.entries(FACILITY_CODES).find(([, f]) => f === town.facility)?.[0] ?? "data-center") as FacilityCode;
  return `/find?q=${encodeURIComponent(code ? `${town.name}, ${code}` : town.name)}&facility=${fac}`;
}
