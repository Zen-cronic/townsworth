import "server-only";

// Thin server-side client for the Qloo Insights API (hackathon environment).
// Responses are cached privately by Next's data cache; never write them to the repo.

const BASE = process.env.QLOO_API_URL ?? "https://hackathon.api.qloo.com";

export type EntityType = "artist" | "tv_show" | "podcast" | "brand" | "place";

export interface QlooTag {
  name: string;
  type?: string;
  id?: string;
}

export interface QlooEntity {
  id: string;
  name: string;
  type: EntityType;
  affinity?: number;
  distanceM?: number;
  popularity?: number;
  tags: QlooTag[];
  description?: string;
  address?: string;
  city?: string;
  phone?: string;
  website?: string;
  rating?: number;
  eventSpaces?: boolean;
  isClosed?: boolean;
  goodFor: string[];
  keywords: string[];
  location?: { lat: number; lon: number };
}

export interface QlooCall {
  label: string;
  params: Record<string, string>;
  // HTTP status, or 0 when the request never got an answer (network error, timeout).
  status: number;
  ok: boolean;
  count: number;
  ms: number;
}

export interface QlooResult {
  entities: QlooEntity[];
  call: QlooCall;
}

function asBool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === "True" || v === "true") return true;
  if (v === "False" || v === "false") return false;
  return undefined;
}

// The subset of the raw Insights entity shape this app reads.
interface RawNamed {
  name?: string;
}
interface RawTag extends RawNamed {
  type?: string;
  tag_id?: string;
  id?: string;
}
interface RawEntity {
  entity_id: string;
  name: string;
  popularity?: number;
  tags?: RawTag[];
  location?: { lat: number; lon: number };
  query?: { affinity?: number; distance?: number };
  properties?: {
    short_description?: string;
    description?: string;
    address?: string;
    geocode?: { city?: string } | null;
    phone?: string;
    website?: string;
    business_rating?: string | number;
    event_spaces?: unknown;
    is_closed?: unknown;
    good_for?: RawNamed[];
    keywords?: RawNamed[];
  };
}

const names = (list: RawNamed[] | undefined, limit = 50) =>
  Array.isArray(list) ? list.slice(0, limit).map((x) => x.name).filter((n): n is string => typeof n === "string") : [];

function parseEntity(raw: RawEntity, type: EntityType): QlooEntity {
  const p = raw.properties ?? {};
  const q = raw.query ?? {};
  const geocode = typeof p.geocode === "object" && p.geocode ? p.geocode : {};
  return {
    id: raw.entity_id,
    name: raw.name,
    type,
    affinity: typeof q.affinity === "number" ? q.affinity : undefined,
    distanceM: typeof q.distance === "number" ? q.distance : undefined,
    popularity: typeof raw.popularity === "number" ? raw.popularity : undefined,
    tags: (raw.tags ?? [])
      .filter((t): t is RawTag & { name: string } => typeof t?.name === "string")
      .map((t) => ({ name: t.name, type: t.type, id: t.tag_id ?? t.id })),
    description: p.short_description ?? p.description,
    address: p.address,
    city: geocode.city ?? undefined,
    phone: p.phone,
    website: p.website,
    rating: p.business_rating != null ? Number(p.business_rating) : undefined,
    eventSpaces: asBool(p.event_spaces),
    isClosed: asBool(p.is_closed),
    goodFor: names(p.good_for),
    keywords: names(p.keywords, 25),
    location: raw.location ? { lat: raw.location.lat, lon: raw.location.lon } : undefined,
  };
}

// At most 4 requests in flight per server instance (module state, not a global limit). 429s retry
// with backoff up to three times; a 502 or 503 retries once.
const MAX_IN_FLIGHT = 4;
let inFlight = 0;
const waiters: (() => void)[] = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (inFlight >= MAX_IN_FLIGHT) await new Promise<void>((r) => waiters.push(r));
  inFlight++;
  try {
    return await fn();
  } finally {
    inFlight--;
    waiters.shift()?.();
  }
}

async function fetchWithRetry(url: string, key: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await withSlot(() =>
      fetch(url, { headers: { "X-Api-Key": key, Accept: "application/json" }, next: { revalidate: 60 * 60 * 24 } }),
    );
    const transient = (res.status === 502 || res.status === 503) && attempt < 1;
    if (!transient && (res.status !== 429 || attempt >= 3)) return res;
    await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
  }
}

async function insights(label: string, params: Record<string, string>, type: EntityType): Promise<QlooResult> {
  const key = process.env.QLOO_API_KEY;
  if (!key) throw new Error("QLOO_API_KEY is not set");
  const url = `${BASE}/v2/insights?${new URLSearchParams(params)}`;
  const started = Date.now();
  // A failed call is recorded as an error, never silently treated as "no results" (thin data).
  let status = 0;
  let raw: RawEntity[] = [];
  try {
    const res = await fetchWithRetry(url, key);
    status = res.status;
    const body = res.ok ? await res.json() : null;
    raw = body?.results?.entities ?? [];
  } catch {
    // No answer at all: keep status 0 so the UI reports an error rather than thin data.
  }
  const entities = raw.map((r) => parseEntity(r, type));
  const ok = status >= 200 && status < 300;
  return { entities, call: { label, params, status, ok, count: entities.length, ms: Date.now() - started } };
}

const point = (lat: number, lon: number) => `POINT(${lon} ${lat})`;

// Taste near a point: what people around this location over-index on.
export function tasteNear(type: Exclude<EntityType, "place">, lat: number, lon: number, take = 20) {
  return insights(`${type} near point`, {
    "filter.type": `urn:entity:${type}`,
    "signal.location": point(lat, lon),
    take: String(take),
  }, type);
}

// National baseline, used to measure what is distinctly local.
export function tasteNational(type: Exclude<EntityType, "place">, country: "United States" | "Canada", take = 20) {
  return insights(`${type} national (${country})`, {
    "filter.type": `urn:entity:${type}`,
    "signal.location.query": country,
    take: String(take),
  }, type);
}

// Real places within a radius: the candidate local partners and venues. `signal.location` at the
// same point makes Qloo rank them by local affinity (query.affinity) instead of returning a plain
// nearby list, so partner selection follows what the town favours, with distance only as a tie-break.
// In thin towns the affinity-ranked query returns only the few places that carry a local affinity
// score, so the caller tops it up with the plain radius query (`ranked = false`).
export function placesNear(lat: number, lon: number, radiusM = 15000, take = 50, ranked = true) {
  const params: Record<string, string> = {
    "filter.type": "urn:entity:place",
    "filter.location": point(lat, lon),
    "filter.location.radius": String(radiusM),
  };
  if (ranked) params["signal.location"] = point(lat, lon);
  params.take = String(take);
  const km = Math.round(radiusM / 1000);
  return insights(ranked ? `places within ${km} km, ranked by local affinity` : `places within ${km} km, by distance (top-up)`, params, "place");
}
