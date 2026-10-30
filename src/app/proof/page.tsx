import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { LiveDataNotice } from "@/components/LiveDataNotice";
import { Figure } from "@/components/dashboard/Figure";
import { Chevron } from "@/components/dashboard/Icons";
import { StatusPill } from "@/components/dashboard/StatusPill";
import type { PickRef } from "@/lib/plan";
import { computeProof } from "@/lib/proof";
import { PRODUCT_NAME } from "@/components/landing/brand";
import { favourRank } from "@/components/ui/labels";
import { ReachProof } from "@/components/qloo/ReachProof";

export const metadata: Metadata = {
  title: `Evidence · ${PRODUCT_NAME}`,
  description: "Checks a facility's draft community plan line by line against the places the host town actually goes (Qloo taste data), and returns a costed, resident-ranked program.",
};

// Per request: never freeze a failed Qloo call into the page (see src/lib/qloo.ts).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Bar = { label: string; pct: number; tone: "llm" | "gn" };

function Bars({ bars }: { bars: Bar[] }) {
  return (
    <div className="mt-4 space-y-1.5">
      {bars.map((b) => (
        <div key={b.label} className="grid grid-cols-[5.5rem_1fr_2.75rem] items-center gap-2 text-[11px] text-muted">
          <span className="truncate">{b.label}</span>
          <span className="proof-bar-track h-1.5 overflow-hidden rounded-full bg-hairline">
            <span className={`proof-bar is-${b.tone} block h-full rounded-full ${b.tone === "gn" ? "bg-ink" : "bg-line-faint"}`} style={{ width: `${Math.max(b.pct, 1.5)}%` }} />
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
      <details className="ui-more mt-4">
        <summary>How it&apos;s measured</summary>
        <div>{note}</div>
      </details>
    </div>
  );
}

function Pick({ p, qloo = false }: { p?: PickRef; qloo?: boolean }) {
  if (!p) return <span className="text-muted">No pick</span>;
  return (
    <span>
      <span className="font-medium text-ink">{p.name}</span>
      <span className="block font-mono text-[11px] tabular-nums text-muted">
        {p.distanceKm != null && `${p.distanceKm} km · `}
        <span className={qloo && p.affinityRank != null ? "qloo-rank" : undefined}>{p.affinityRank != null ? favourRank(p.affinityRank) : "not ranked by Qloo"}</span>
        {p.city && ` · ${p.city}`}
      </span>
    </span>
  );
}

export default async function ProofPage() {
  const { towns, totals, baseline, failedTowns } = await computeProof();
  const num = "px-4 py-3 text-right font-mono tabular-nums";
  const changed = towns.filter((t) => t.swaps.length > 0);
  const kemmerer = towns.find((t) => t.slug === "kemmerer-wy");
  const replacementsLine =
    totals.gnReplacements === 0
      ? `${PRODUCT_NAME} put in no new partners in this run.`
      : `${totals.gnReplacementsLocalPct === 100 ? "Every one" : `${totals.gnReplacementsLocalPct}%`} of the ${totals.gnReplacements} partners ${PRODUCT_NAME} puts in exists locally in Qloo's places${
          totals.gnReplacementsAllRanked
            ? " and is ranked by Qloo for how much locals favour it."
            : `; ${totals.gnReplacementsRankedPct}% are ranked by Qloo for how much locals favour them, the rest listed by distance where Qloo has no rank.`
        }`;

  return (
    <>
      <AppHeader towns={false} page="proof" />
      <main id="main" className="ui-page">
        <div className="proof-band lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-12">
          <header className="max-w-3xl">
            <p className="lp-kicker">Evidence · {towns.length} host towns</p>
            <h1 className="lp-h1 mt-3">
              Qloo grounds the AI plan <span className="lp-tone">in where the town actually goes.</span>
            </h1>
            <p className="lp-lede mt-4">
              {totals.llmVerifiedPct}% of the partners AI alone named could be confirmed ({totals.llmVerified} of {totals.llmNamed}). {replacementsLine}
            </p>
            <LiveDataNotice towns={failedTowns} className="mt-3" retry />
            <details className="ui-more mt-3">
              <summary>How the test was set up</summary>
              <div>
                For each of {towns.length} host towns we asked the same model, with no Qloo access, to write the community plan a consultant would write,
                and froze those plans before measuring. Then we compared them with what {PRODUCT_NAME} proposes from Qloo&apos;s local taste data.
              </div>
            </details>
          </header>

          {/* Findings */}
          <section id="findings" aria-label="Findings" className="mt-8 grid scroll-mt-24 gap-px overflow-hidden rounded-lg bg-hairline shadow-[0_0_0_1px_var(--hairline)] md:grid-cols-2 lg:mt-1">
            <Finding
              n="1"
              big={`${totals.llmVerifiedPct}%`}
              label="of the partners AI alone named could be confirmed"
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
                { label: PRODUCT_NAME, pct: totals.gnInstitutionalPct, tone: "gn" },
              ]}
              note="AI alone reaches for the college, the district, the library and the chamber. Qloo surfaces the places residents actually go."
            />
            <Finding
              n="3"
              big={`${totals.gnNovelPct}%`}
              label={`of ${PRODUCT_NAME}'s local partners AI alone never named`}
              note="Qloo isn't re-deriving what the model already knows. It adds a layer the model doesn't have."
            />
            <Finding
              n="4"
              big={`${totals.affinityChangedPct}%`}
              label="of picks change without Qloo's taste ranking (ordered by distance, like a nearby-places directory)"
              note={`Same candidate places, same venue-fit and host-community rules; only the order differs: how much locals favour each place (Qloo) vs distance from the site. The share of ${PRODUCT_NAME}'s picks a distance-only directory would not make.`}
            />
          </section>
        </div>

        {/* What Qloo changes */}
        <section id="what-qloo-changes" aria-labelledby="qloo-changes" className="mt-6 scroll-mt-24 ui-card">
          <div className="border-b border-rule px-5 py-4 sm:px-6">
            <h2 id="qloo-changes" className="font-semibold">What Qloo changes</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Each pick that ranking by what locals favour (Qloo) makes and ranking by distance alone would not, next to the pick the
              distance ranking makes instead. Same venue-fit and host-community rules.
            </p>
          </div>
          {changed.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted sm:px-6">No picks change in this run: the distance-only ranking makes the same choices.</p>
          ) : (
            <>
            {/* Phones: one block per pick, the same data in the same order as the table. */}
            <ul className="divide-y divide-hairline text-sm sm:hidden">
              {changed.flatMap((t) =>
                t.swaps.map((s) => (
                  <li key={`${t.slug}-${s.slot}-${s.qloo.id}`} className="px-5 py-3">
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted">{s.slot}</p>
                    <dl className="mt-2 grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 gap-y-2">
                      <dt className="text-xs text-muted">Distance only</dt>
                      <dd>
                        <Pick p={s.distance} />
                      </dd>
                      <dt className="text-xs text-qloo">Ranked by Qloo</dt>
                      <dd>
                        <Pick p={s.qloo} qloo />
                      </dd>
                    </dl>
                  </li>
                )),
              )}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-hairline text-[11px] uppercase tracking-wider text-muted">
                    <th scope="col" className="px-4 py-2.5 pl-5 text-left font-medium sm:pl-6">Town · slot</th>
                    <th scope="col" className="px-4 py-2.5 text-left font-medium">Distance only</th>
                    <th scope="col" className="px-4 py-2.5 pr-6 text-left font-medium text-qloo">Ranked by Qloo</th>
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
                          <Pick p={s.qloo} qloo />
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
            </>
          )}
        </section>

        {/* Two control checks, in the same figure style as the findings */}
        <section aria-label="Control checks" className="mt-4 grid gap-px overflow-hidden rounded-lg bg-hairline shadow-[0_0_0_1px_var(--hairline)] sm:grid-cols-2">
          <div className="bg-paper px-5 py-5 sm:px-6">
            <p className="ui-stat-v">
              <Figure value={`${totals.controlOwnPct}% vs ${totals.controlCrossPct}%`} />
            </p>
            <p className="mt-2 font-medium leading-snug">Own-town check: partners found in their own town vs a different town</p>
            <details className="ui-more mt-2">
              <summary>What this measures</summary>
              <div>
                Partners are picked from the town&apos;s own list and the towns are far apart, so this has to hold. It checks that no town reads
                another town&apos;s data; it is not evidence that Qloo improves the plan.
              </div>
            </details>
          </div>
          <div className="bg-paper px-5 py-5 sm:px-6">
            <p className="ui-stat-v">
              <Figure value={`${totals.llmPlanSimilarityPct}% vs ${totals.gnPartnerOverlapPct}%`} />
            </p>
            <p className="mt-2 font-medium leading-snug">Repeat check: plan wording shared across towns, AI alone vs {PRODUCT_NAME}</p>
            <details className="ui-more mt-2">
              <summary>What this measures</summary>
              <div>
                AI-alone plans for different towns share {totals.llmPlanSimilarityPct}% of their content words (town and partner names removed);{" "}
                {PRODUCT_NAME}&apos;s partner lists overlap {totals.gnPartnerOverlapPct}%. Different measures: AI alone writes one plan and fills in
                names, while the Qloo plan is built from each town.
              </div>
            </details>
          </div>
        </section>

        {/* By town */}
        <section aria-labelledby="by-town" className="mt-6 ui-card">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule px-5 py-4 sm:px-6">
            <h2 id="by-town" className="font-semibold">By town</h2>
            <p className="text-xs text-muted">Local partners are program items with a named local place. Open a town to see its line-by-line check.</p>
          </div>
          {/* Phones: one block per town, the same columns as label and value pairs. */}
          <ul className="divide-y divide-hairline text-sm sm:hidden">
            {towns.map((t) => (
              <li key={t.slug} className="px-5 py-3">
                <p className="flex flex-wrap items-center gap-2">
                  <Link href={`/town/${t.slug}`} className="group inline-flex items-center gap-1.5 rounded font-medium">
                    {t.name}
                    <Chevron className="h-3 w-3 text-muted" />
                  </Link>
                  {t.thin && <StatusPill tone="warn">Thin data</StatusPill>}
                  {t.failed && <StatusPill tone="warn">Qloo didn&apos;t answer</StatusPill>}
                </p>
                <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-xs">
                  {(
                    [
                      ["Partners AI alone named", String(t.llmNamed)],
                      ["Verified real", `${t.llmVerified} / ${t.llmNamed}`],
                      ["Institutions", String(t.llmInstitutional)],
                      [`${PRODUCT_NAME} local partners`, String(t.gnPartners)],
                      ["Also named by AI alone", String(t.gnAlsoNamedByLlm)],
                      ["Changed by Qloo", `${t.gnPicksChangedByAffinity} / ${t.gnPicks}`],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-muted">{k}</dt>
                      <dd className="text-right font-mono tabular-nums text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-hairline text-[11px] uppercase tracking-wider text-muted">
                  <th scope="col" className="sticky left-0 z-10 bg-paper px-4 py-2.5 pl-5 text-left font-medium sm:pl-6">Town</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Partners AI alone named</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Verified real</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Institutions</th>
                  <th scope="col" className="qloo-col border-l border-hairline px-4 py-2.5 text-right font-medium">{PRODUCT_NAME} local partners</th>
                  <th scope="col" className="qloo-col px-4 py-2.5 text-right font-medium">Also named by AI alone</th>
                  <th scope="col" className="qloo-col px-4 py-2.5 pr-6 text-right font-medium">Changed by Qloo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {towns.map((t) => (
                  <tr key={t.slug}>
                    <td className="sticky left-0 z-10 bg-paper px-4 py-3 pl-5 sm:pl-6">
                      <Link href={`/town/${t.slug}`} className="group inline-flex items-center gap-1.5 rounded font-medium hover:text-ink">
                        {t.name}
                        <Chevron className="h-3 w-3 text-muted group-hover:text-ink" />
                      </Link>
                      {t.thin && (
                        <span className="ml-2">
                          <StatusPill tone="warn">Thin data</StatusPill>
                        </span>
                      )}
                      {t.failed && (
                        <span className="ml-2">
                          <StatusPill tone="warn">Qloo didn&apos;t answer</StatusPill>
                        </span>
                      )}
                    </td>
                    <td className={num}>{t.llmNamed}</td>
                    <td className={num}>
                      {t.llmVerified}
                      <span className="text-muted"> / {t.llmNamed}</span>
                    </td>
                    <td className={num}>{t.llmInstitutional}</td>
                    <td className={`${num} qloo-col border-l border-hairline`}>{t.gnPartners}</td>
                    <td className={`${num} qloo-col`}>{t.gnAlsoNamedByLlm}</td>
                    <td className={`${num} qloo-col pr-6`}>
                      {t.gnPicksChangedByAffinity}
                      <span className="text-muted"> / {t.gnPicks}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Age groups */}
        <ReachProof towns={towns} />

        {/* Method and limits */}
        <section className="mt-6 grid gap-6 md:grid-cols-2">
          <details className="proof-method ui-card text-sm md:order-2">
            <summary>
              <h2 className="inline font-semibold">How this was run</h2>
            </summary>
            <ul className="mt-3 space-y-2 text-muted">
              <li>Baseline: OpenAI {baseline.model}, frozen {baseline.createdAt.slice(0, 10)} before any measurement.</li>
              <li>{PRODUCT_NAME}: live Qloo Insights calls (places within 15 km, plus local taste), with the same deterministic rules for every town.</li>
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
          </details>
          <div id="limits" className="proof-limits scroll-mt-24 text-sm md:order-1">
            <h2 className="flex items-center gap-2 font-semibold">
              <span aria-hidden className="h-2 w-2 rounded-full bg-amber" />
              What this does not prove
            </h2>
            <ul className="mt-3 space-y-2 text-muted">
              <li>That residents value a Qloo-grounded program more, or that it changes attendance or acceptance.</li>
              <li>{towns.length === 6 ? "Six" : towns.length} towns and one model: a directional check, not a statistical study.</li>
              <li>Institutions are good partners too. The claim is that the LLM finds only them, not that they are wrong.</li>
              <li>A partner&apos;s availability or willingness is not confirmed by either arm.</li>
              <li>
                The age-group check uses Qloo&apos;s aggregate place affinities for each group; no resident is scored, and it doesn&apos;t show who
                would attend.
              </li>
              <li>
                {PRODUCT_NAME}&apos;s side is recomputed from live Qloo calls on every visit. When a call fails, the page says which town it
                hit; that town&apos;s figures are then computed from partial data, so reload before reading them.
              </li>
            </ul>
          </div>
        </section>
      </main>
    </>
  );
}
