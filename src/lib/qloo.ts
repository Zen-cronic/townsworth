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
  status: number;
  count: number;
  ms: number;
  quotaRemaining?: string;
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

// Qloo allows 10 requests/second per key. Keep at most 4 in flight and retry 429s with backoff.
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
    if (res.status !== 429 || attempt >= 3) return res;
    await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
  }
}

async function insights(label: string, params: Record<string, string>, type: EntityType): Promise<QlooResult> {
  const key = process.env.QLOO_API_KEY;
  if (!key) throw new Error("QLOO_API_KEY is not set");
  const url = `${BASE}/v2/insights?${new URLSearchParams(params)}`;
  const started = Date.now();
  const res = await fetchWithRetry(url, key);
  const ms = Date.now() - started;
  const body = res.ok ? await res.json() : null;
  const raw: RawEntity[] = body?.results?.entities ?? [];
  const entities = raw.map((r) => parseEntity(r, type));
  return {
    entities,
    call: {
      label,
      params,
      status: res.status,
      count: entities.length,
      ms,
      quotaRemaining: res.headers.get("x-month-ratelimit-remaining") ?? undefined,
    },
  };
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

// Real places within a radius: the candidate local partners and venues.
export function placesNear(lat: number, lon: number, radiusM = 15000, take = 50) {
  return insights(`places within ${Math.round(radiusM / 1000)} km`, {
    "filter.type": "urn:entity:place",
    "filter.location": point(lat, lon),
    "filter.location.radius": String(radiusM),
    take: String(take),
  }, "place");
}
