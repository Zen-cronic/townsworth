import "server-only";
import { CA_PROVINCES, customSlug, inCountry, presetNear, US_STATES, type FacilityCode, type Town } from "./towns";

// OpenStreetMap Nominatim, per its usage policy: identify the app, at most one request a second,
// cache results. Only a town name (or a partner name the LLM wrote) is ever sent.

const BASE = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "good-neighbor-hackathon/1.0 (contact via GitHub)";
const GAP_MS = 1100;

let nextSlot = 0;
async function politeFetch(params: URLSearchParams) {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + GAP_MS;
  if (wait) await new Promise((r) => setTimeout(r, wait));
  return fetch(`${BASE}?${params}`, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
    next: { revalidate: 86400 },
  });
}

// Letters, spaces and the punctuation town names use. No digits, so no street addresses or postcodes.
export function cleanTownQuery(raw: string | undefined) {
  return (raw ?? "")
    .replace(/[^\p{L}\p{M}\s,.'’-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export interface TownCandidate {
  label: string;
  name: string;
  region: string;
  regionCode: string;
  country: Town["country"];
  kind: string;
  lat: number;
  lon: number;
  slug: string;
  preset?: Town;
}

interface RawResult {
  name?: string;
  lat: string;
  lon: string;
  addresstype?: string;
  address?: Record<string, string>;
}

const SETTLEMENT = new Set(["city", "town", "village", "hamlet", "municipality", "borough", "suburb", "neighbourhood", "quarter"]);

function regionCodeOf(a: Record<string, string>): string | undefined {
  const iso = a["ISO3166-2-lvl4"];
  if (iso && /^(US|CA)-[A-Z]{2}$/.test(iso)) return iso.slice(3);
  const table = a.country_code === "ca" ? CA_PROVINCES : US_STATES;
  return Object.entries(table).find(([, n]) => n === a.state)?.[0];
}

export type GeocodeResult = { ok: true; candidates: TownCandidate[] } | { ok: false; status: number };

export async function geocodeTowns(query: string, facility: FacilityCode): Promise<GeocodeResult> {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    countrycodes: "us,ca",
    featureType: "settlement",
    addressdetails: "1",
    limit: "10",
  });
  let res: Response;
  try {
    res = await politeFetch(params);
  } catch {
    return { ok: false, status: 0 };
  }
  if (!res.ok) return { ok: false, status: res.status };
  const raw = (await res.json()) as RawResult[];
  const seen = new Set<string>();
  const candidates: TownCandidate[] = [];
  for (const r of raw) {
    const a = r.address ?? {};
    if (!r.name || !SETTLEMENT.has(r.addresstype ?? "")) continue;
    const country: Town["country"] = a.country_code === "ca" ? "Canada" : "United States";
    const regionCode = regionCodeOf(a);
    const lat = Number(r.lat);
    const lon = Number(r.lon);
    if (!regionCode || !Number.isFinite(lat) || !Number.isFinite(lon) || !inCountry(country, lat, lon)) continue;
    const region = (country === "Canada" ? CA_PROVINCES : US_STATES)[regionCode];
    const key = `${r.name}|${regionCode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({
      label: `${r.name}, ${region}, ${country === "Canada" ? "Canada" : "US"}`,
      name: r.name,
      region,
      regionCode,
      country,
      kind: r.addresstype ?? "place",
      lat,
      lon,
      slug: customSlug(r.name, regionCode, lat, lon, facility),
      preset: presetNear(lat, lon),
    });
    if (candidates.length === 5) break;
  }
  return { ok: true, candidates };
}

function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export interface OsmCheck {
  status: number;
  found: boolean;
  osmName?: string;
  km?: number;
}

// The same check the frozen baseline used (scripts/freeze-baseline.ts): a bounded box around
// the town, up to three hits, and a match only within 25 km.
export async function osmLookup(name: string, town: { lat: number; lon: number }): Promise<OsmCheck> {
  const d = 0.25;
  const params = new URLSearchParams({
    q: name,
    format: "jsonv2",
    limit: "3",
    viewbox: `${town.lon - d},${town.lat + d},${town.lon + d},${town.lat - d}`,
    bounded: "1",
  });
  let res: Response;
  try {
    res = await politeFetch(params);
  } catch {
    return { status: 0, found: false };
  }
  if (!res.ok) return { status: res.status, found: false };
  const hits = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  const near = hits.find((h) => km(town, { lat: Number(h.lat), lon: Number(h.lon) }) <= 25);
  return near
    ? {
        status: 200,
        found: true,
        osmName: near.display_name.split(",")[0],
        km: Math.round(km(town, { lat: Number(near.lat), lon: Number(near.lon) }) * 10) / 10,
      }
    : { status: 200, found: false };
}
