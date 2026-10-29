import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Figure } from "@/components/dashboard/Figure";
import { Chevron } from "@/components/dashboard/Icons";
import { StatusPill } from "@/components/dashboard/StatusPill";
import type { PickRef } from "@/lib/plan";
import { computeProof } from "@/lib/proof";
import { PRODUCT_NAME } from "@/components/landing/brand";

export const metadata: Metadata = {
  title: `Evidence · ${PRODUCT_NAME}`,
  description: "Checks a facility's draft community plan line by line against the places the host town actually goes (Qloo taste data), and returns a costed, resident-ranked program.",
};

export const dynamic = "force-dynamic";

type Bar = { label: string; pct: number; tone: "llm" | "gn" };

function Bars({ bars }: { bars: Bar[] }) {
  return (
    <div className="mt-4 space-y-1.5">
      {bars.map((b) => (
        <div key={b.label} className="grid grid-cols-[5.5rem_1fr_2.75rem] items-center gap-2 text-[11px] text-muted">
          <span className="truncate">{b.label}</span>
          <span className="h-1.5 overflow-hidden rounded-full bg-hairline">
            <span className={`block h-full rounded-full ${b.tone === "gn" ? "bg-ok" : "bg-ink/50"}`} style={{ width: `${Math.max(b.pct, 1.5)}%` }} />
          </span>
          <span className="text-right font-mono tabular-nums text-ink">{b.pct}%</span>
        </div>
      ))}
    </div>
  );
}

function Finding({ n, big, label, note, bars }: { n: string; big: string; label: string; note: string; bars?: Bar[] }) {
  return (
    <div id={`finding-${n}`} className="flex scroll-mt-24 flex-col bg-paper px-5 py-6 sm:px-6">
      <p className="text-[2.25rem] leading-none">
        <Figure value={big} />
      </p>
      <p className="mt-3 font-medium leading-snug">{label}</p>
      {bars && <Bars bars={bars} />}
      <p className="mt-4 text-sm leading-relaxed text-muted">{note}</p>
    </div>
  );
}

function Pick({ p }: { p?: PickRef }) {
  if (!p) return <span className="text-muted">No pick</span>;
  return (
    <span>
      <span className="font-medium text-ink">{p.name}</span>
      <span className="block font-mono text-[11px] tabular-nums text-muted">
        {[p.distanceKm != null && `${p.distanceKm} km`, p.affinityRank != null ? `#${p.affinityRank} local affinity` : "no affinity score", p.city]
          .filter(Boolean)
          .join(" · ")}
      </span>
    </span>
  );
}

export default async function ProofPage() {
  const { towns, totals, baseline } = await computeProof();
  const num = "px-4 py-3 text-right font-mono tabular-nums";
  const changed = towns.filter((t) => t.swaps.length > 0);
  const kemmerer = towns.find((t) => t.slug === "kemmerer-wy");
  const replacementsLine =
    totals.gnReplacements === 0
      ? `${PRODUCT_NAME} put in no new partners in this run.`
      : `${totals.gnReplacementsLocalPct === 100 ? "Every one" : `${totals.gnReplacementsLocalPct}%`} of the ${totals.gnReplacements} partners ${PRODUCT_NAME} puts in exists locally in Qloo's places${
          totals.gnReplacementsAllRanked
            ? " and is ranked by local affinity."
            : `; ${totals.gnReplacementsRankedPct}% are ranked by local affinity, the rest listed by distance where Qloo has no affinity score.`
        }`;

  return (
    <>
      <AppHeader page="proof" />
      <main className="mx-auto max-w-[1200px] px-4 pb-24 pt-8 sm:px-6 sm:pt-10">
        <header className="max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">Evidence · {towns.length} host towns · recomputed on every load</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight md:text-[2.5rem]">
            Qloo grounds the AI plan in where the town actually goes.
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-ink">
            {totals.llmVerifiedPct}% of the partners AI alone named could be confirmed ({totals.llmVerified} of {totals.llmNamed}). {replacementsLine}
          </p>
          <p className="mt-3 leading-relaxed text-muted">
            For each of {towns.length} host towns we asked the same model, with no Qloo access, to write the community plan a consultant would write,
            and froze those plans before measuring. Then we compared them with what {PRODUCT_NAME} proposes from Qloo&apos;s local taste data.
          </p>
        </header>

        {/* Findings */}
        <section id="findings" aria-label="Findings" className="mt-8 grid scroll-mt-24 gap-px overflow-hidden rounded-lg border border-rule bg-hairline md:grid-cols-2 lg:grid-cols-4">
          <Finding
            n="1"
            big={`${totals.llmVerifiedPct}%`}
            label="of the partners AI alone named could be confirmed"
            bars={[{ label: "Verified", pct: totals.llmVerifiedPct, tone: "llm" }]}
            note={`Verified against Qloo or OpenStreetMap within 25 km. In well-mapped towns the LLM mostly names real institutions${
              kemmerer ? `; in thin-data Kemmerer only ${kemmerer.llmVerified} of ${kemmerer.llmNamed} could be verified` : ""
            }. Unverified is not proof of invented.`}
          />
          <Finding
            n="2"
            big={`${totals.llmInstitutionalPct}% vs ${totals.gnInstitutionalPct}%`}
            label={`of partners are institutions: AI alone vs ${PRODUCT_NAME}`}
            bars={[
              { label: "AI alone", pct: totals.llmInstitutionalPct, tone: "llm" },
              { label: "Good Neighbor", pct: totals.gnInstitutionalPct, tone: "gn" },
            ]}
            note="AI alone reaches for the college, the district, the library and the chamber. Qloo surfaces the places residents actually go."
          />
          <Finding
            n="3"
            big={`${totals.gnNovelPct}%`}
            label={`of ${PRODUCT_NAME}'s local partners AI alone never named`}
            bars={[{ label: "Never named", pct: totals.gnNovelPct, tone: "gn" }]}
            note="Qloo isn't re-deriving what the model already knows. It adds a layer the model doesn't have."
          />
          <Finding
            n="4"
            big={`${totals.affinityChangedPct}%`}
            label="of picks change without Qloo's taste ranking (ordered by distance, like a nearby-places directory)"
            bars={[{ label: "Changed", pct: totals.affinityChangedPct, tone: "gn" }]}
            note="Same candidate places, same venue-fit and host-community rules; only the order differs: Qloo's local affinity vs distance from the site. The share of Good Neighbor's picks a distance-only directory would not make."
          />
        </section>

        {/* What Qloo changes */}
        <section id="what-qloo-changes" aria-labelledby="qloo-changes" className="mt-6 scroll-mt-24 rounded-lg border border-rule bg-paper">
          <div className="border-b border-rule px-5 py-4 sm:px-6">
            <h2 id="qloo-changes" className="font-semibold">What Qloo changes</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Each pick Qloo&apos;s local-affinity ranking makes that a distance-only ranking of the same candidates would not, next to the pick the
              distance ranking makes instead. Same venue-fit and host-community rules, recomputed on this load.
            </p>
          </div>
          {changed.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted sm:px-6">No picks change in this run: the distance-only ranking makes the same choices.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-hairline text-[11px] uppercase tracking-wider text-muted">
                    <th scope="col" className="px-4 py-2.5 pl-5 text-left font-medium sm:pl-6">Town · slot</th>
                    <th scope="col" className="px-4 py-2.5 text-left font-medium">Distance only</th>
                    <th scope="col" className="px-4 py-2.5 pr-6 text-left font-medium">Ranked by Qloo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {changed.flatMap((t) =>
                    t.swaps.map((s) => (
                      <tr key={`${t.slug}-${s.slot}-${s.qloo.id}`}>
                        <td className="px-4 py-3 pl-5 align-top sm:pl-6">
                          <span className="font-medium">{t.name}</span>
                          <span className="block text-xs text-muted">{s.slot}</span>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Pick p={s.distance} />
                        </td>
                        <td className="px-4 py-3 pr-6 align-top">
                          <Pick p={s.qloo} />
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Wiring check */}
        <section className="mt-6 grid gap-5 rounded-lg border border-dashed border-rule bg-paper px-5 py-5 sm:px-6 md:grid-cols-[14rem_1fr] md:items-center">
          <div>
            <h2 className="font-semibold">Wiring check: holds by construction</h2>
            <p className="mt-2 font-mono text-2xl font-medium tabular-nums">
              {totals.controlOwnPct}% vs {totals.controlCrossPct}%
            </p>
          </div>
          <p className="text-sm leading-relaxed text-muted">
            {PRODUCT_NAME}&apos;s local partners appear in their own town&apos;s Qloo places {totals.controlOwnPct}% of the time and in another
            town&apos;s {totals.controlCrossPct}%. Partners are picked from the town&apos;s own list and the towns are far apart, so this has to hold.
            It checks the wiring (no town reads another town&apos;s data); it is not evidence that Qloo improves the plan.
          </p>
        </section>

        {/* Template check */}
        <section className="mt-6 grid gap-5 rounded-lg border border-rule bg-paper px-5 py-5 sm:px-6 md:grid-cols-[14rem_1fr] md:items-center">
          <div>
            <h2 className="font-semibold">Template check</h2>
            <div className="mt-2 flex items-baseline gap-4 font-mono tabular-nums">
              <span>
                <span className="text-2xl font-medium">{totals.llmPlanSimilarityPct}%</span>
                <span className="ml-1 font-sans text-xs text-muted">AI alone</span>
              </span>
              <span>
                <span className="text-2xl font-medium">{totals.gnPartnerOverlapPct}%</span>
                <span className="ml-1 font-sans text-xs text-muted">Good Neighbor</span>
              </span>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-muted">
            AI-alone plans for different towns share {totals.llmPlanSimilarityPct}% of their content words on average (town names and partner names removed).
            Good Neighbor&apos;s partner lists for different towns overlap {totals.gnPartnerOverlapPct}%. Different measures; the point is that the LLM
            writes one plan and fills in names, while the Qloo plan is built from each town.
          </p>
        </section>

        {/* By town */}
        <section aria-labelledby="by-town" className="mt-6 rounded-lg border border-rule bg-paper">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule px-5 py-4 sm:px-6">
            <h2 id="by-town" className="font-semibold">By town</h2>
            <p className="text-xs text-muted">Local partners are program items with a named local place. Open a town to see its line-by-line check.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-hairline text-[11px] uppercase tracking-wider text-muted">
                  <th scope="col" className="sticky left-0 z-10 bg-paper px-4 py-2.5 pl-5 text-left font-medium sm:pl-6">Town</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Partners AI alone named</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Verified real</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Institutions</th>
                  <th scope="col" className="border-l border-hairline px-4 py-2.5 text-right font-medium">{PRODUCT_NAME} local partners</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Also named by AI alone</th>
                  <th scope="col" className="px-4 py-2.5 pr-6 text-right font-medium">Changed by affinity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {towns.map((t) => (
                  <tr key={t.slug}>
                    <td className="sticky left-0 z-10 bg-paper px-4 py-3 pl-5 sm:pl-6">
                      <Link href={`/town/${t.slug}`} className="group inline-flex items-center gap-1.5 rounded font-medium hover:text-hivis-text">
                        {t.name}
                        <Chevron className="h-3 w-3 text-muted group-hover:text-hivis-text" />
                      </Link>
                      {t.thin && (
                        <span className="ml-2">
                          <StatusPill tone="warn">Thin data</StatusPill>
                        </span>
                      )}
                    </td>
                    <td className={num}>{t.llmNamed}</td>
                    <td className={num}>
                      {t.llmVerified}
                      <span className="text-muted"> / {t.llmNamed}</span>
                    </td>
                    <td className={num}>{t.llmInstitutional}</td>
                    <td className={`${num} border-l border-hairline`}>{t.gnPartners}</td>
                    <td className={num}>{t.gnAlsoNamedByLlm}</td>
                    <td className={`${num} pr-6`}>
                      {t.gnPicksChangedByAffinity}
                      <span className="text-muted"> / {t.gnPicks}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Method and limits */}
        <section className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-rule bg-paper px-5 py-5 text-sm sm:px-6">
            <h2 className="font-semibold">How this was run</h2>
            <ul className="mt-3 space-y-2 text-muted">
              <li>Baseline: OpenAI {baseline.model}, frozen {baseline.createdAt.slice(0, 10)} before any measurement.</li>
              <li>Good Neighbor: live Qloo Insights calls (places within 15 km, plus local taste), with the same deterministic rules for every town.</li>
              <li>
                &ldquo;Institution&rdquo; is one keyword rule (college, university, school, district, library, chamber, city, county, department, EDC,
                foundation, park, zoo, museum…), applied identically to both sides.
              </li>
              <li>An OpenStreetMap hit verifies a partner only if it shares a distinctive name word with it: a settlement or a different body doesn&apos;t count.</li>
            </ul>
            <details className="group mt-4 border-t border-hairline pt-3">
              <summary className="inline-flex cursor-pointer items-center gap-1.5 rounded text-xs font-medium text-muted hover:text-ink">
                <Chevron className="chev h-3 w-3" />
                Reproducibility details
              </summary>
              <dl className="mt-2 space-y-1 text-xs text-muted">
                <div>
                  <dt className="inline">Prompt version: </dt>
                  <dd className="inline font-mono">{baseline.promptVersion}</dd>
                </div>
                <div className="break-all">
                  <dt className="inline">SHA-256 of the frozen file: </dt>
                  <dd className="inline font-mono">{baseline.sha256}</dd>
                </div>
              </dl>
            </details>
          </div>
          <div id="limits" className="scroll-mt-24 rounded-lg border border-amber/35 bg-paper px-5 py-5 text-sm sm:px-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <span aria-hidden className="h-2 w-2 rounded-full bg-amber" />
              What this does not prove
            </h2>
            <ul className="mt-3 space-y-2 text-muted">
              <li>That residents value a Qloo-grounded program more, or that it changes attendance or acceptance.</li>
              <li>{towns.length === 6 ? "Six" : towns.length} towns and one model: a directional check, not a statistical study.</li>
              <li>Institutions are good partners too. The claim is that the LLM finds only them, not that they are wrong.</li>
              <li>A partner&apos;s availability or willingness is not confirmed by either arm.</li>
            </ul>
          </div>
        </section>
      </main>
    </>
  );
}
