import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { buildProfile, type PlaceMeta, type TownProfile } from "./profile";
import { townBySlug } from "./towns";

// A complete town profile is kept for a day across requests, so a page that needs six towns doesn't
// replay some 150 cached Qloo reads through the rate limiter. An incomplete one (any failed call,
// town-wide or age-group) is never kept: the next load asks Qloo again, as the fetch cache does.

type Stored = Omit<TownProfile, "placeMeta" | "themeVocabulary"> & {
  placeMeta: [string, PlaceMeta][];
  themeVocabulary: [string, string[]][];
};

class Incomplete extends Error {
  constructor(readonly profile: TownProfile) {
    super("incomplete town profile");
  }
}

export const isComplete = (p: TownProfile) => !p.failedCalls.length && !(p.lensCalls ?? []).some((c) => !c.ok);

const stored = unstable_cache(
  async (slug: string): Promise<Stored> => {
    const profile = await buildProfile(townBySlug(slug)!);
    if (!isComplete(profile)) throw new Incomplete(profile);
    return { ...profile, placeMeta: [...profile.placeMeta], themeVocabulary: [...profile.themeVocabulary] };
  },
  ["town-profile-v1"],
  { revalidate: 86400 },
);

// One profile per town per request; `runTown` asks for it once per draft source.
export const townProfile = cache(async (slug: string): Promise<TownProfile> => {
  try {
    const s = await stored(slug);
    return { ...s, placeMeta: new Map(s.placeMeta), themeVocabulary: new Map(s.themeVocabulary) };
  } catch (e) {
    if (e instanceof Incomplete) return e.profile;
    throw e;
  }
});
