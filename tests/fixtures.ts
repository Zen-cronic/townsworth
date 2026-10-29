// Small hand-written fixtures. None of this is Qloo API output.
import type { EntityType, QlooEntity } from "../src/lib/qloo";
import type { Signal, TownProfile } from "../src/lib/profile";
import { townBySlug } from "../src/lib/towns";

export function entity(id: string, name: string, opts: Partial<QlooEntity> & { cats?: string[]; type?: EntityType } = {}): QlooEntity {
  const { cats = [], type = "place", ...rest } = opts;
  return {
    id,
    name,
    type,
    tags: cats.map((c) => ({ name: c, type: "urn:tag:category:place" })),
    goodFor: [],
    keywords: [],
    ...rest,
  };
}

const signal = (e: QlooEntity, rank: number): Signal => ({ entity: e, rank, nationalRank: null, metroHits: 0, distinct: true });

const emptyTaste = () => ({ brand: [] as Signal[], artist: [] as Signal[], tv_show: [] as Signal[], podcast: [] as Signal[] });
const strength = (local: boolean) => ({ distinct: local ? 3 : 0, total: 3, local });

export function profileOf(places: QlooEntity[], opts: { artists?: string[]; vocab?: Record<string, string[]>; thin?: boolean } = {}): TownProfile {
  const town = townBySlug("mount-pleasant-wi")!;
  const taste = emptyTaste();
  taste.artist = (opts.artists ?? []).map((n, i) => signal(entity(`a${i}`, n, { type: "artist" }), i + 1));
  return {
    town,
    places,
    localPlaces: places,
    placeCount: places.length,
    affinityRanked: places.length,
    placeMeta: new Map(places.map((p, i) => [p.id, { affinityRank: i + 1, host: true, inTown: true, city: town.name }])),
    taste,
    strength: { brand: strength(false), artist: strength(taste.artist.length > 0), tv_show: strength(false), podcast: strength(false) },
    excluded: [],
    themeVocabulary: new Map(Object.entries(opts.vocab ?? {})),
    calls: [],
    failedCalls: [],
    distinctShare: 0.5,
    thin: !!opts.thin,
  };
}

export const NORMAL_PLACES: QlooEntity[] = [
  entity("p1", "Lakeside Community Center", { cats: ["Community center"], distanceM: 2100, eventSpaces: true }),
  entity("p2", "Gateway Technical College", { cats: ["Community college"], distanceM: 6400 }),
  entity("p3", "Kringle Corner Bakery", { cats: ["Bakery"], distanceM: 1800, phone: "+1 262-555-0100" }),
  entity("p4", "Harbor Brewing", { cats: ["Brewery"], distanceM: 3300 }),
  entity("p5", "River Bend Museum", { cats: ["Museum"], distanceM: 4200 }),
  entity("p6", "Pike River Park", { cats: ["Park"], distanceM: 2500 }),
];
