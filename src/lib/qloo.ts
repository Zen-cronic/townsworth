import "server-only";
import { unstable_cache } from "next/cache";
import { SEARCH_RADIUS_KM } from "./geo";
import { parseAreaTags, parseDemographics, type AgeProfile, type AreaTag } from "./qlooInsights";

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

// At most 6 requests in flight per server instance (module state, not a global limit), and starts
// spaced to about 9 a second: Qloo allows 10 a second per key, and fast answers would otherwise let
// 6 slots exceed it. Only requests that go to Qloo take a slot; cached responses (below) never wait.
// A freed slot passes straight to the next waiter, so a new arrival can't take it in between.
// 429s retry after a second, up to three times; a 502 or 503 retries once.
const MAX_IN_FLIGHT = 6;
const MIN_GAP_MS = 110;
let inFlight = 0;
let nextStart = 0;
const waiters: (() => void)[] = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (inFlight < MAX_IN_FLIGHT) inFlight++;
  else await new Promise<void>((r) => waiters.push(r));
  const now = Date.now();
  const at = Math.max(now, nextStart);
  nextStart = at + MIN_GAP_MS;
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
  try {
    return await fn();
  } finally {
    const next = waiters.shift();
    if (next) next();
    else inFlight--;
  }
}

async function fetchWithRetry(url: string, key: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await withSlot(() => fetch(url, { headers: { "X-Api-Key": key, Accept: "application/json" }, cache: "no-store" }));
    const transient = (res.status === 502 || res.status === 503) && attempt < 1;
    if (!transient && (res.status !== 429 || attempt >= 3)) return res;
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
}

// Caching policy. Each successful Qloo response is kept for 24 hours in Next's data cache, keyed by
// its request URL (the key is read inside, so it is never part of the cache key). Only a 2xx whose
// body parses is stored: a failed call throws out of the cache, so the next request asks Qloo again
// rather than remembering the failure. The limiter above runs only on a miss, so warm pages read
// every response at once. That guarantee is lost if the page that made the call is itself cached: a
// statically prerendered or ISR page stores its HTML, and a failure during that render (at build
// time or on the first visit) would be served for the whole revalidate window even though the data
// cache holds nothing for it. So every route that renders Qloo-derived figures (runTown,
// computeProof) is rendered per request with `export const dynamic = "force-dynamic"`, or uses
// request data that makes it dynamic anyway. When a call does fail, the profile records it in
// `failedCalls` and the pages say so instead of showing partial figures.
class QlooFailure extends Error {
  constructor(readonly status: number) {
    super(`Qloo answered ${status}`);
  }
}

async function liveBody(url: string): Promise<unknown> {
  const res = await fetchWithRetry(url, process.env.QLOO_API_KEY!);
  if (!res.ok) throw new QlooFailure(res.status);
  return await res.json();
}

const storedBody = unstable_cache(liveBody, ["qloo-response-v1"], { revalidate: 60 * 60 * 24 });

// Outside a Next server (unit tests, scripts) there is no data cache, so the call goes straight out.
async function cachedBody(url: string): Promise<unknown> {
  try {
    return await storedBody(url);
  } catch (e) {
    if (e instanceof Error && /incrementalCache missing/.test(e.message)) return liveBody(url);
    throw e;
  }
}

// One Qloo GET, shared by every endpoint: the key check, timing and status. A missing key throws (a
// configuration error, never "no results"); a request with no answer, or a 2xx whose body isn't
// JSON, comes back as status 0, so it is reported as a failed call rather than as no results.
async function qlooGet<T>(path: string, params: Record<string, string>, { noStore = false } = {}) {
  const key = process.env.QLOO_API_KEY;
  if (!key) throw new Error("QLOO_API_KEY is not set");
  const started = Date.now();
  let status = 0;
  let body: T | null = null;
  const url = `${BASE}${path}?${new URLSearchParams(params)}`;
  try {
    if (noStore) {
      // Lookups built from user-pasted text skip the cache: they must not outlive the request.
      const res = await fetchWithRetry(url, key);
      body = res.ok ? ((await res.json()) as T) : null;
      status = res.status;
    } else {
      body = (await cachedBody(url)) as T;
      status = 200;
    }
  } catch (e) {
    // Qloo's own status when it answered with an error; otherwise no answer at all (or a body that
    // isn't JSON), so status stays 0 and the UI reports an error rather than thin data.
    if (e instanceof QlooFailure) status = e.status;
  }
  return { status, ok: status >= 200 && status < 300, body, ms: Date.now() - started };
}

// A failed call is recorded as an error, never silently treated as "no results" (thin data).
async function insights(label: string, params: Record<string, string>, type: EntityType): Promise<QlooResult> {
  const res = await qlooGet<{ results?: { entities?: unknown } }>("/v2/insights", params);
  const raw = (Array.isArray(res.body?.results?.entities) ? res.body.results.entities : []) as RawEntity[];
  const entities = raw.filter((r) => typeof r?.entity_id === "string" && typeof r?.name === "string").map((r) => parseEntity(r, type));
  return { entities, call: { label, params, status: res.status, ok: res.ok, count: entities.length, ms: res.ms } };
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

// Age-group and life-stage views of the same places query. Each lens re-ranks the places within the
// radius for one aggregate group; no individual is scored. Only these parameter names are ever sent.
export type LensSignal = { "signal.demographics.age": "24_and_younger" | "55_and_older" } | { "signal.demographics.audiences": string };

export function placesForLens(label: string, signal: LensSignal, lat: number, lon: number, radiusM = 15000, take = 15) {
  return insights(label, {
    "filter.type": "urn:entity:place",
    "filter.location": point(lat, lon),
    "filter.location.radius": String(radiusM),
    "signal.location": point(lat, lon),
    ...signal,
    take: String(take),
  }, "place");
}

// Most partner ids sent in one audience-profile call; a 400 splits the batch into two calls once.
export const AGE_BATCH = 15;

// The audience age profile of each partner: Qloo's aggregate age affinities for the people who
// favour the place. Only the age buckets are kept (see parseDemographics); gender is discarded. A
// partner without a row has no profile, never a zero. A failed call returns no rows and its call
// record, for the caller to keep apart from the town's own calls.
export async function partnerDemographics(ids: string[]): Promise<{ ages: Map<string, AgeProfile>; calls: QlooCall[] }> {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, AGE_BATCH);
  const ages = new Map<string, AgeProfile>();
  const calls: QlooCall[] = [];
  const ask = async (batch: string[], label: string) => {
    const params = { "filter.type": "urn:demographics", "signal.interests.entities": batch.join(",") };
    const res = await qlooGet<unknown>("/v2/insights", params);
    const rows = res.ok ? parseDemographics(res.body) : new Map<string, AgeProfile>();
    calls.push({ label, params, status: res.status, ok: res.ok, count: rows.size, ms: res.ms });
    return { status: res.status, rows };
  };
  if (!unique.length) return { ages, calls };
  const first = await ask(unique, "audience age profile per partner");
  if (first.status === 400 && unique.length > 1) {
    const half = Math.ceil(unique.length / 2);
    const parts = await Promise.all([unique.slice(0, half), unique.slice(half)].map((b, i) => ask(b, `audience age profile per partner (part ${i + 1} of 2)`)));
    parts.forEach((p) => p.rows.forEach((v, k) => ages.set(k, v)));
  } else {
    first.rows.forEach((v, k) => ages.set(k, v));
  }
  // Only ids that were asked about: an unexpected row is ignored.
  for (const k of [...ages.keys()]) if (!unique.includes(k)) ages.delete(k);
  return { ages, calls };
}

// The place traits (genres, ambience, dishes, activities) that places around the point over-index
// on, in Qloo's order. Identity, sensitive and generic tags are dropped in parseAreaTags before
// anything is ranked or shown.
export async function areaPlaceTags(lat: number, lon: number, take = 50): Promise<{ tags: AreaTag[]; call: QlooCall }> {
  const params = { "filter.type": "urn:tag", "signal.location": point(lat, lon), "filter.parents.types": "urn:entity:place", take: String(take) };
  const res = await qlooGet<unknown>("/v2/insights", params);
  const tags = res.ok ? parseAreaTags(res.body) : [];
  return { tags, call: { label: "place traits near point", params, status: res.status, ok: res.ok, count: tags.length, ms: res.ms } };
}

export interface QlooAudience {
  id: string;
  name: string;
}

// The life-stage list, so the "Parents With Young Children" id is read from Qloo at runtime.
export async function lifeStageAudiences(): Promise<{ audiences: QlooAudience[]; call: QlooCall }> {
  const params = { "filter.parents.types": "urn:audience:life_stage", take: "50" };
  const res = await qlooGet<{ results?: { audiences?: unknown } }>("/v2/audiences", params);
  const list = (Array.isArray(res.body?.results?.audiences) ? res.body.results.audiences : []) as { id?: unknown; name?: unknown }[];
  const audiences = list
    .filter((a): a is { id: string; name: string } => typeof a?.id === "string" && typeof a?.name === "string")
    .map((a) => ({ id: a.id, name: a.name }));
  return { audiences, call: { label: "life-stage groups", params, status: res.status, ok: res.ok, count: audiences.length, ms: res.ms } };
}

export interface QlooSearchResult {
  entities: QlooEntity[];
  status: number;
  ok: boolean;
}

// Name lookup for one venue a pasted plan mentions, near the site. Never cached: the query comes
// from user text. The radius filter is a hint to Qloo's ranking, so callers still check distance.
export async function searchPlaces(query: string, lat: number, lon: number, radiusKm = SEARCH_RADIUS_KM, take = 5): Promise<QlooSearchResult> {
  const params = { query, types: "urn:entity:place", "filter.location": `${lat},${lon}`, "filter.radius": String(radiusKm), take: String(take) };
  const res = await qlooGet<{ results?: unknown }>("/search", params, { noStore: true });
  const raw = (Array.isArray(res.body?.results) ? res.body.results : []) as RawEntity[];
  return { entities: raw.filter((r) => typeof r?.entity_id === "string" && typeof r?.name === "string").map((r) => parseEntity(r, "place")), status: res.status, ok: res.ok };
}
