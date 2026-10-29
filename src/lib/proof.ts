import "server-only";
import { BASELINE, BASELINE_SHA256, baselineFor, isInstitution, namedPartner } from "./baselineData";
import { cleanName, type PickSwap } from "./plan";
import { runTown } from "./run";
import { TOWNS } from "./towns";

// Every number on /proof is recomputed here on request from the frozen baseline and live Qloo runs.

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const STOP = new Set("a an and the of for to in on at with by from or as is be this that their its our your local community program programs town city village county 24 month months year years data center centre plant site project".split(" "));

function contentWords(text: string, drop: string[]) {
  const dropSet = new Set(drop.flatMap((d) => norm(d).split(" ")));
  return new Set(norm(text).split(" ").filter((w) => w.length > 3 && !STOP.has(w) && !dropSet.has(w)));
}

function jaccard<T>(a: Set<T>, b: Set<T>) {
  const inter = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union ? inter / union : 0;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const pct = (x: number) => Math.round(x * 100);

export interface TownProof {
  slug: string;
  name: string;
  llmNamed: number;
  llmVerified: number;
  llmInstitutional: number;
  gnPartners: number;
  gnInstitutional: number;
  gnAlsoNamedByLlm: number;
  // Qloo-affinity partner picks that a distance-only pick of the same candidates would not make.
  gnPicks: number;
  gnPicksChangedByAffinity: number;
  // The partners the check puts in (swaps for struck lines, items added alongside kept ones).
  gnReplacements: number;
  // ...that are in this town's Qloo places within 15 km, and that carry a Qloo local-affinity rank.
  gnReplacementsLocal: number;
  gnReplacementsRanked: number;
  // Each pick the distance-only ranking would not make, next to the one it would make instead.
  swaps: PickSwap[];
  thin: boolean;
}

export async function computeProof() {
  const runs = await Promise.all(TOWNS.map((t) => runTown(t.slug, undefined, "llm")));
  const towns: TownProof[] = [];
  const llmWords: Set<string>[] = [];
  const gnPartnerSets: Set<string>[] = [];
  const placeSets: Set<string>[] = [];

  runs.forEach((run, i) => {
    if (!run) return;
    const town = TOWNS[i];
    const baseline = baselineFor(town.slug);
    const named = run.audit.filter((_, k) => namedPartner(baseline[k]?.partner));
    const llmPartners = baseline.map((b) => namedPartner(b.partner)).filter((p): p is string => !!p);
    const distancePicks = new Set(run.program.picks.distance);
    const gnPartners = run.program.items.map((it) => it.partner?.name).filter((p): p is string => !!p);
    const llmText = norm(baseline.map((b) => `${b.partner ?? ""} ${b.item}`).join(" "));
    const ownPlaces = new Set(run.profile.places.map((p) => norm(cleanName(p.name))));
    const added = run.audit.flatMap((r) => [r.replacement, r.alongside]).filter((it) => it?.partner);

    towns.push({
      slug: town.slug,
      name: `${town.name}, ${town.region}`,
      llmNamed: llmPartners.length,
      llmVerified: named.filter((r) => r.matched).length,
      llmInstitutional: llmPartners.filter(isInstitution).length,
      gnPartners: gnPartners.length,
      gnInstitutional: gnPartners.filter(isInstitution).length,
      gnAlsoNamedByLlm: gnPartners.filter((p) => llmText.includes(norm(p))).length,
      gnPicks: run.program.picks.affinity.length,
      gnPicksChangedByAffinity: run.program.picks.affinity.filter((id) => !distancePicks.has(id)).length,
      gnReplacements: added.length,
      gnReplacementsLocal: added.filter((it) => ownPlaces.has(norm(it!.partner!.name))).length,
      gnReplacementsRanked: added.filter((it) => ownPlaces.has(norm(it!.partner!.name)) && it!.partner!.affinityRank != null).length,
      swaps: run.program.picks.swaps.filter((s) => !distancePicks.has(s.qloo.id)),
      thin: run.profile.thin,
    });
    llmWords.push(contentWords(baseline.map((b) => b.item).join(" "), [town.name, town.region, ...llmPartners]));
    gnPartnerSets.push(new Set(gnPartners.map(norm)));
    placeSets.push(new Set(run.profile.places.map((p) => norm(cleanName(p.name)))));
  });

  const pairs: [number, number][] = [];
  for (let a = 0; a < towns.length; a++) for (let b = a + 1; b < towns.length; b++) pairs.push([a, b]);

  // Sanity check, true by construction: partners are picked from their own town's Qloo places, so
  // they are found there (100%) and, 15 km lists being disjoint, not in another town's. Not a finding.
  // Towns with no partner places have nothing to check and are left out.
  const crossHits: number[] = [];
  const ownHits: number[] = [];
  for (let a = 0; a < towns.length; a++) {
    const set = gnPartnerSets[a];
    if (!set.size) continue;
    ownHits.push([...set].filter((p) => placeSets[a].has(p)).length / set.size);
    for (let b = 0; b < towns.length; b++) {
      if (a !== b) crossHits.push([...set].filter((p) => placeSets[b].has(p)).length / set.size);
    }
  }

  const sum = (f: (t: TownProof) => number) => towns.reduce((s, t) => s + f(t), 0);
  return {
    towns,
    totals: {
      llmVerifiedPct: pct(sum((t) => t.llmVerified) / Math.max(1, sum((t) => t.llmNamed))),
      llmInstitutionalPct: pct(sum((t) => t.llmInstitutional) / Math.max(1, sum((t) => t.llmNamed))),
      gnInstitutionalPct: pct(sum((t) => t.gnInstitutional) / Math.max(1, sum((t) => t.gnPartners))),
      gnNovelPct: pct(1 - sum((t) => t.gnAlsoNamedByLlm) / Math.max(1, sum((t) => t.gnPartners))),
      llmPlanSimilarityPct: pct(mean(pairs.map(([a, b]) => jaccard(llmWords[a], llmWords[b])))),
      gnPartnerOverlapPct: pct(mean(pairs.map(([a, b]) => jaccard(gnPartnerSets[a], gnPartnerSets[b])))),
      controlOwnPct: pct(mean(ownHits)),
      controlCrossPct: pct(mean(crossHits)),
      affinityChangedPct: pct(sum((t) => t.gnPicksChangedByAffinity) / Math.max(1, sum((t) => t.gnPicks))),
      llmNamed: sum((t) => t.llmNamed),
      llmVerified: sum((t) => t.llmVerified),
      gnReplacements: sum((t) => t.gnReplacements),
      gnReplacementsLocalPct: pct(sum((t) => t.gnReplacementsLocal) / Math.max(1, sum((t) => t.gnReplacements))),
      gnReplacementsRankedPct: pct(sum((t) => t.gnReplacementsRanked) / Math.max(1, sum((t) => t.gnReplacements))),
      gnReplacementsAllRanked: sum((t) => t.gnReplacementsRanked) === sum((t) => t.gnReplacements),
    },
    baseline: { model: BASELINE.model, promptVersion: BASELINE.promptVersion, createdAt: BASELINE.createdAt, sha256: BASELINE_SHA256 },
  };
}
