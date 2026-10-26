import "server-only";
import { placesNear, tasteNational, tasteNear, type EntityType, type QlooCall, type QlooEntity } from "./qloo";
import { isLocalPartner, signalTags, splitSafe, type ExclusionReason } from "./filters";
import type { Town } from "./towns";

type TasteType = Exclude<EntityType, "place">;

export interface Signal {
  entity: QlooEntity;
  rank: number;
  nationalRank: number | null;
  metroHits: number;
  distinct: boolean;
}

export interface TownProfile {
  town: Town;
  places: QlooEntity[];
  localPlaces: QlooEntity[];
  taste: Record<TasteType, Signal[]>;
  excluded: { name: string; type: EntityType; reason: ExclusionReason }[];
  themeVocabulary: Map<string, string[]>;
  calls: QlooCall[];
  distinctShare: number;
  thin: boolean;
}

const TASTE_TYPES: TasteType[] = ["brand", "artist", "tv_show", "podcast"];

// Reference metros: an entity popular in two or more of these is "big-city popular", not distinctly local.
const REFERENCE_METROS: Record<Town["country"], [number, number][]> = {
  "United States": [[40.7128, -74.006], [34.0522, -118.2437], [41.8781, -87.6298], [29.7604, -95.3698]],
  Canada: [[43.6532, -79.3832], [49.2827, -123.1207], [45.5019, -73.5674]],
};

// Theme words too generic to count as a local signal on their own.
const GENERIC_THEMES = /^(place|restaurant|bar|hotel|shopping|tourist attraction|park|event venue|music|pop|entertainment|television|podcast|comedy|lifestyle|news|sports|food|drama|reality|family|american)$/i;

function addTheme(vocab: Map<string, string[]>, term: string, source: string) {
  const key = term.toLowerCase().trim();
  if (key.length < 3 || GENERIC_THEMES.test(key)) return;
  const sources = vocab.get(key) ?? [];
  if (!sources.includes(source)) sources.push(source);
  vocab.set(key, sources);
}

export async function buildProfile(town: Town): Promise<TownProfile> {
  const refs = REFERENCE_METROS[town.country].filter(([lat, lon]) => Math.hypot(lat - town.lat, lon - town.lon) > 0.5);
  const [placesRes, localRes, nationalRes, refRes] = await Promise.all([
    placesNear(town.lat, town.lon, 15000, 50),
    Promise.all(TASTE_TYPES.map((t) => tasteNear(t, town.lat, town.lon, 20))),
    Promise.all(TASTE_TYPES.map((t) => tasteNational(t, town.country, 20))),
    Promise.all(TASTE_TYPES.map((t) => Promise.all(refs.map(([lat, lon]) => tasteNear(t, lat, lon, 20))))),
  ]);

  const calls: QlooCall[] = [
    placesRes.call,
    ...localRes.map((r) => r.call),
    ...nationalRes.map((r) => r.call),
    ...refRes.flat().map((r) => ({ ...r.call, label: `${r.call.label} (reference metro)` })),
  ];
  const excluded: TownProfile["excluded"] = [];

  const placeSplit = splitSafe(placesRes.entities);
  placeSplit.excluded.forEach((x) => excluded.push({ name: x.entity.name, type: "place", reason: x.reason }));
  const places = placeSplit.kept;
  const localPlaces = places.filter(isLocalPartner);

  const taste = {} as Record<TasteType, Signal[]>;
  TASTE_TYPES.forEach((t, i) => {
    const split = splitSafe(localRes[i].entities);
    split.excluded.forEach((x) => excluded.push({ name: x.entity.name, type: t, reason: x.reason }));
    const nationalIndex = new Map(nationalRes[i].entities.map((e, k) => [e.id, k + 1]));
    const refSets = refRes[i].map((r) => new Set(r.entities.map((e) => e.id)));
    taste[t] = split.kept.map((entity, k) => {
      const nationalRank = nationalIndex.get(entity.id) ?? null;
      const metroHits = refSets.filter((s) => s.has(entity.id)).length;
      return { entity, rank: k + 1, nationalRank, metroHits, distinct: nationalRank === null && metroHits < 2 };
    });
  });

  // Themes come only from distinctly local taste entities. Place categories (school, park, breakfast
  // restaurant) exist in every town, so they never count as a distinct signal.
  const themeVocabulary = new Map<string, string[]>();
  for (const t of TASTE_TYPES) {
    for (const s of taste[t].filter((x) => x.distinct)) {
      addTheme(themeVocabulary, s.entity.name, s.entity.name);
      for (const tag of signalTags(s.entity).slice(0, 6)) addTheme(themeVocabulary, tag.name, s.entity.name);
    }
  }

  const allSignals = TASTE_TYPES.flatMap((t) => taste[t]);
  const distinctShare = allSignals.length ? allSignals.filter((s) => s.distinct).length / allSignals.length : 0;

  return {
    town,
    places,
    localPlaces,
    taste,
    excluded,
    themeVocabulary,
    calls,
    distinctShare,
    thin: localPlaces.length < 15 || allSignals.length < 40,
  };
}
