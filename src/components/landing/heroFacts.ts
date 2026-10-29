import "server-only";
import { isKept } from "@/lib/audit";
import type { TownRun } from "@/lib/run";

const num = (n: number) => String(n);

// Deep-link targets in the example town, found from today's run so the anchors always land on a
// real line: the strongest swap, and an institution the check keeps.
export function heroFacts(run: TownRun) {
  const { audit, town } = run;
  const swaps = audit
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => !isKept(r.verdict) && r.replacement?.partner)
    .sort(
      (a, b) =>
        Number(!!a.r.replacement!.partner!.neighbouring) - Number(!!b.r.replacement!.partner!.neighbouring) ||
        (a.r.replacement!.partner!.affinityRank ?? 1e6) - (b.r.replacement!.partner!.affinityRank ?? 1e6),
    );
  const swap = swaps[0];
  const inst = audit.map((r, i) => ({ r, i })).find(({ r }) => r.verdict === "institution");
  const town_ = `/town/${town.slug}`;
  return {
    townHref: town_,
    memoHref: `/memo/${town.slug}`,
    ballotHref: `/ballot/${town.slug}`,
    resultsHref: `/ballot/${town.slug}/results`,
    swap: swap
      ? {
          line: num(swap.i + 1),
          href: `${town_}#line-${num(swap.i + 1)}`,
          title: swap.r.replacement!.title,
          partner: swap.r.replacement!.partner!.name,
          rank: swap.r.replacement!.partner!.affinityRank,
        }
      : undefined,
    institution: inst ? { line: num(inst.i + 1), href: `${town_}#line-${num(inst.i + 1)}`, name: inst.r.named ?? "" } : undefined,
  };
}

export type HeroFacts = ReturnType<typeof heroFacts>;
