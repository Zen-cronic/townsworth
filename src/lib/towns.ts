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
    facility: "nuclear",
    defaultAnnualFund: 500_000,
    fundNote: "Illustrative. A thin-data host: expect fewer grounded picks.",
    thinData: true,
  },
];

export const HERO_TOWN = TOWNS[0];

// Custom towns: everything a route needs is encoded in the slug, so no server state is kept.
// Format: <Name-With-Hyphens>-<REGION>~<lat>_<lon>~<facility>, e.g. Taylor-TX~30.5729_-97.4141~fab

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

export function customSlug(name: string, regionCode: string, lat: number, lon: number, facility: FacilityCode): string {
  return `${nameToken(name)}-${regionCode.toUpperCase()}~${lat.toFixed(4)}_${lon.toFixed(4)}~${facility}`;
}

const CUSTOM_SLUG = /^([A-Za-z0-9.]+(?:-[A-Za-z0-9.]+)*)-([A-Za-z]{2})~(-?\d{1,2}(?:\.\d{1,6})?)_(-?\d{1,3}(?:\.\d{1,6})?)~(data-center|fab|nuclear|plant)$/;

export function parseCustomSlug(slug: string): Town | undefined {
  if (slug.length > 120) return undefined;
  const m = CUSTOM_SLUG.exec(slug);
  if (!m) return undefined;
  const [, token, code, latRaw, lonRaw, facilityCode] = m;
  const place = regionFor(code);
  const name = token.replace(/-/g, " ").trim();
  if (!place || name.length < 2 || name.length > 60 || !/[A-Za-z]/.test(name)) return undefined;
  const lat = Number(latRaw);
  const lon = Number(lonRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inCountry(place.country, lat, lon)) return undefined;
  const facility = facilityCode as FacilityCode;
  return {
    slug: customSlug(name, code, lat, lon, facility),
    name,
    region: place.region,
    country: place.country,
    lat,
    lon,
    project: `${FACILITY_PROJECT[facility]} project (entered by you)`,
    facility: FACILITY_CODES[facility],
    defaultAnnualFund: 1_000_000,
    fundNote: "Illustrative default for a town you entered. Replace with your actual community fund.",
    custom: true,
  };
}

// A preset within ~10 km of a point, so a typed-in preset town keeps its frozen LLM plan.
export function presetNear(lat: number, lon: number, km = 10): Town | undefined {
  return TOWNS.find((t) => Math.hypot((t.lat - lat) * 110.57, (t.lon - lon) * 111.32 * Math.cos((lat * Math.PI) / 180)) <= km);
}

export function townBySlug(slug: string): Town | undefined {
  return TOWNS.find((t) => t.slug === slug) ?? parseCustomSlug(slug);
}
