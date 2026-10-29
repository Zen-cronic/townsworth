import "server-only";
import { placesNear, tasteNational, tasteNear, type EntityType, type QlooCall, type QlooEntity } from "./qloo";
import { brandKey, isChain, isLocalPartner, isMegabrand, signalTags, splitSafe, type ExclusionReason } from "./filters";
import type { Town } from "./towns";

type TasteType = Exclude<EntityType, "place">;

export interface Signal {
  entity: QlooEntity;
  rank: number;
  nationalRank: number | null;
  metroHits: number;
  distinct: boolean;
}

// Where a candidate place sits in Qloo's affinity ranking, and whether it is in the host community.
export interface PlaceMeta {
  // Undefined for top-up places that Qloo returned without a local affinity score.
  affinityRank?: number;
  host: boolean;
  // Strictly in the host municipality: same postal city (or the town named in the address) and
  // within the host radius. Grants prefer these before any neighbouring place.
  inTown: boolean;
  city?: string;
}

// Whether a taste type carries a local signal at all. "Distinct" means absent from the national top
// 50 and from every big-metro list. In metro suburbs the artist/TV/podcast lists are still mostly
// national pop; when fewer than half the local list is distinct, the type "leans national": it is
// shown as such and no plan item is built from it.
export interface TasteStrength {
  distinct: number;
  total: number;
  local: boolean;
}

export interface TownProfile {
  town: Town;
  places: QlooEntity[];
  localPlaces: QlooEntity[];
  // How many places Qloo returned within the radius (before any filter), for "#3 of 50" provenance.
  placeCount: number;
  // How many of those carry a Qloo local-affinity rank (the rest are a by-distance top-up).
  affinityRanked: number;
  placeMeta: Map<string, PlaceMeta>;
  taste: Record<TasteType, Signal[]>;
  strength: Record<TasteType, TasteStrength>;
  excluded: { name: string; type: EntityType; reason: ExclusionReason }[];
  // Display term -> the distinct local entities it came from.
  themeVocabulary: Map<string, string[]>;
  calls: QlooCall[];
  failedCalls: QlooCall[];
  distinctShare: number;
  thin: boolean;
}

const TASTE_TYPES: TasteType[] = ["brand", "artist", "tv_show", "podcast"];

// Reference metros: an entity in any of these lists is "big-city popular", not distinctly local.
const REFERENCE_METROS: Record<Town["country"], [number, number][]> = {
  "United States": [[40.7128, -74.006], [34.0522, -118.2437], [41.8781, -87.6298], [29.7604, -95.3698]],
  Canada: [[43.6532, -79.3832], [49.2827, -123.1207], [45.5019, -73.5674]],
};

// The national baseline is deep (top 50), so "distinct" means absent from it, not just below #20.
const NATIONAL_TAKE = 50;
// Within this distance a place counts as the host community even if its postal city differs.
const HOST_RADIUS_M = 8000;

// Theme words too generic to count as a local signal on their own.
const GENERIC_THEMES = /^(place|restaurant|bar|hotel|shopping|tourist attraction|park|event venue|music|pop|entertainment|television|podcast|comedy|lifestyle|news|sports|food|drama|reality|family|american)$/i;
// Single-word names that are ordinary English words: "a purchasing target" is not Target.
const COMMON_WORDS = new Set(
  "target apple subway shell gap express sonic amazon square delta frontier spirit united people time today dove tide gain joy bounty crest pledge raid glad chase discover ally citizens regions key guess coach champion vans converse ford ram jeep dodge lincoln mercury saturn genesis smart"
    .split(" "),
);

export function addTheme(vocab: Map<string, string[]>, term: string, source: string, fromTag: boolean, national: Set<string>) {
  const display = term.trim();
  const key = display.toLowerCase();
  const words = key.split(/\s+/).filter(Boolean);
  if (key.length < 3 || GENERIC_THEMES.test(key) || isChain(display) || isMegabrand(display, national)) return;
  // Tags are descriptors ("country", "polka"), so only multi-word tags can stand as a theme.
  if (words.length < 2 && (fromTag || COMMON_WORDS.has(key))) return;
  const sources = vocab.get(display) ?? [];
  if (!sources.includes(source)) sources.push(source);
  vocab.set(display, sources);
}

// Distinct: absent from the national top 50 and every big-metro list, and not a national platform or
// megabrand (Instagram, Starbucks...) or a name on the national top-50 brand list.
export function isDistinct(name: string, nationalRank: number | null, metroHits: number, nationalBrands: Set<string>) {
  return nationalRank === null && metroHits === 0 && !isMegabrand(name, nationalBrands);
}

const normCity = (s?: string) => (s ?? "").toLowerCase().replace(/^(village|town|city|township) of /, "").replace(/[^a-z]+/g, " ").trim();

export async function buildProfile(town: Town): Promise<TownProfile> {
  const refs = REFERENCE_METROS[town.country].filter(([lat, lon]) => Math.hypot(lat - town.lat, lon - town.lon) > 0.5);
  const [placesRes, localRes, nationalRes, refRes] = await Promise.all([
    placesNear(town.lat, town.lon, 15000, 50),
    Promise.all(TASTE_TYPES.map((t) => tasteNear(t, town.lat, town.lon, 20))),
    Promise.all(TASTE_TYPES.map((t) => tasteNational(t, town.country, NATIONAL_TAKE))),
    Promise.all(TASTE_TYPES.map((t) => Promise.all(refs.map(([lat, lon]) => tasteNear(t, lat, lon, 20))))),
  ]);

  // Thin towns: Qloo ranks only the places that have a local affinity score. Top the list up with
  // the plain radius query; those extra places rank after every affinity-ranked one, by distance.
  const PLACES_TAKE = 50;
  const topUp = placesRes.call.ok && placesRes.entities.length < PLACES_TAKE ? await placesNear(town.lat, town.lon, 15000, PLACES_TAKE, false) : null;
  if (topUp) {
    const seen = new Set(placesRes.entities.map((e) => e.id));
    placesRes.entities.push(...topUp.entities.filter((e) => !seen.has(e.id)).map((e) => ({ ...e, affinity: undefined })));
  }

  const calls: QlooCall[] = [
    placesRes.call,
    ...(topUp ? [topUp.call] : []),
    ...localRes.map((r) => r.call),
    ...nationalRes.map((r) => r.call),
    ...refRes.flat().map((r) => ({ ...r.call, label: `${r.call.label} (reference metro)` })),
  ];
  const excluded: TownProfile["excluded"] = [];

  const placeSplit = splitSafe(placesRes.entities);
  placeSplit.excluded.forEach((x) => excluded.push({ name: x.entity.name, type: "place", reason: x.reason }));
  const places = placeSplit.kept;
  const localPlaces = places.filter(isLocalPartner);

  // Rank every returned place by Qloo's local affinity (signal.location); distance breaks ties.
  const host = normCity(town.name);
  const ranked = [...placesRes.entities].sort(
    (a, b) => (b.affinity ?? -1) - (a.affinity ?? -1) || (a.distanceM ?? 1e9) - (b.distanceM ?? 1e9),
  );
  const placeMeta = new Map<string, PlaceMeta>(
    ranked.map((e, i) => {
      const sameCity = !!host && (normCity(e.city) === host || ` ${normCity(e.address)} `.includes(` ${host} `));
      const near = (e.distanceM ?? 1e9) <= HOST_RADIUS_M;
      return [
        e.id,
        { affinityRank: e.affinity != null ? i + 1 : undefined, host: sameCity || near, inTown: sameCity && near, city: e.city },
      ];
    }),
  );
  const affinityRanked = placesRes.entities.filter((e) => e.affinity != null).length;

  // Anything in the national top-50 brand list is national, whatever its entity type.
  const nationalBrands = new Set(nationalRes[TASTE_TYPES.indexOf("brand")].entities.map((e) => brandKey(e.name)));
  const taste = {} as Record<TasteType, Signal[]>;
  TASTE_TYPES.forEach((t, i) => {
    const split = splitSafe(localRes[i].entities);
    split.excluded.forEach((x) => excluded.push({ name: x.entity.name, type: t, reason: x.reason }));
    const nationalIndex = new Map(nationalRes[i].entities.map((e, k) => [e.id, k + 1]));
    const refSets = refRes[i].map((r) => new Set(r.entities.map((e) => e.id)));
    taste[t] = split.kept.map((entity, k) => {
      const nationalRank = nationalIndex.get(entity.id) ?? null;
      const metroHits = refSets.filter((s) => s.has(entity.id)).length;
      return { entity, rank: k + 1, nationalRank, metroHits, distinct: isDistinct(entity.name, nationalRank, metroHits, nationalBrands) };
    });
  });

  const strength = Object.fromEntries(
    TASTE_TYPES.map((t) => {
      const distinct = taste[t].filter((x) => x.distinct).length;
      // Brands carry local teams and institutions, so any distinct brand counts; media types must be mostly distinct.
      const local = t === "brand" ? distinct > 0 : taste[t].length > 0 && distinct / taste[t].length >= 0.5;
      return [t, { distinct, total: taste[t].length, local }];
    }),
  ) as Record<TasteType, TasteStrength>;

  // Themes come only from distinctly local taste entities. Place categories (school, park, breakfast
  // restaurant) exist in every town, so they never count as a distinct signal.
  const themeVocabulary = new Map<string, string[]>();
  for (const t of TASTE_TYPES.filter((x) => strength[x].local)) {
    for (const s of taste[t].filter((x) => x.distinct)) {
      addTheme(themeVocabulary, s.entity.name, s.entity.name, false, nationalBrands);
      for (const tag of signalTags(s.entity).slice(0, 6)) addTheme(themeVocabulary, tag.name, s.entity.name, true, nationalBrands);
    }
  }

  const allSignals = TASTE_TYPES.flatMap((t) => taste[t]);
  const distinctShare = allSignals.length ? allSignals.filter((s) => s.distinct).length / allSignals.length : 0;
  // Thin data is only a verdict when Qloo actually answered. A failed call is an error, shown as one.
  const failedCalls = calls.filter((c) => !c.ok);

  return {
    town,
    places,
    localPlaces,
    placeCount: placesRes.entities.length,
    affinityRanked,
    placeMeta,
    taste,
    strength,
    excluded,
    themeVocabulary,
    calls,
    failedCalls,
    distinctShare,
    thin: !failedCalls.length && (localPlaces.length < 15 || allSignals.length < 40),
  };
}
