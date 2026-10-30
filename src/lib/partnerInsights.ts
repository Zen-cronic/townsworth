import "server-only";
import { cleanName, km, type ProgramItem } from "./plan";
import type { TownProfile } from "./profile";
import { partnerDemographics, type QlooEntity } from "./qloo";
import { sharedTraits } from "./qlooInsights";

// Qloo add-ons per partner, attached once the program, the audit and the reach check are built. They
// only add display fields to `item.partner`; no amount, verdict, pick or count changes, and their
// calls never join `profile.calls` or `profile.failedCalls`.

// The Qloo place behind a partner. Partners keep no entity id, so the match is on what partnerOf
// copies from the entity: the cleaned name, the address and the distance.
export function partnerEntity(item: ProgramItem, places: QlooEntity[]): QlooEntity | undefined {
  const p = item.partner;
  if (!p) return undefined;
  return places.find((e) => cleanName(e.name) === p.name && e.address === p.address && km(e.distanceM) === p.distanceKm);
}

// Every item that can show a partner, once each, in page order: the program, the age-group
// sessions, then whatever the audit carries (the same objects, normally).
export function partnerItems(lists: (ProgramItem | undefined | null)[][]): ProgramItem[] {
  const seen = new Set<ProgramItem>();
  const out: ProgramItem[] = [];
  for (const list of lists) {
    for (const it of list) {
      if (!it?.partner || seen.has(it)) continue;
      seen.add(it);
      out.push(it);
    }
  }
  return out;
}

// Attaches the area place traits each partner carries (at most two, best-ranked first). Pure: it reads
// `profile.areaTags` and calls nothing. A partner with no overlap gets nothing.
export function addPartnerTraits(profile: TownProfile, items: ProgramItem[]): void {
  if (!profile.areaTags?.length) return;
  for (const it of items) {
    const e = partnerEntity(it, profile.places);
    const traits = e ? sharedTraits(e, profile.areaTags) : [];
    if (traits.length) it.partner!.traits = traits;
  }
}

// Asks Qloo for the partners' audience age profiles (at most 15 places, in batches of 5; see
// partnerDemographics) and attaches each row to its partner. A failed batch attaches nothing for its
// own partners; the others still attach. It never throws.
export async function addPartnerAges(profile: TownProfile, items: ProgramItem[]): Promise<void> {
  const matched = items.map((it) => ({ it, e: partnerEntity(it, profile.places) })).filter((m): m is { it: ProgramItem; e: QlooEntity } => !!m.e);
  const res = await partnerDemographics(matched.map((m) => m.e.id)).catch(() => null);
  profile.ageCalls = res?.calls ?? [];
  profile.partnerAges = res?.ages ?? new Map();
  for (const { it, e } of matched) {
    const age = profile.partnerAges.get(e.id);
    if (age) it.partner!.ages = age;
  }
}
