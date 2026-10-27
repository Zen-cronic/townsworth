import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Figure } from "@/components/dashboard/Figure";
import { Chevron } from "@/components/dashboard/Icons";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { computeProof } from "@/lib/proof";

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
    <div className="flex flex-col bg-paper px-5 py-6 sm:px-6">
      <p className="font-mono text-[11px] text-muted">{n}</p>
      <p className="mt-2 text-[2.25rem] leading-none">
        <Figure value={big} />
      </p>
      <p className="mt-3 font-medium leading-snug">{label}</p>
      {bars && <Bars bars={bars} />}
      <p className="mt-4 text-sm leading-relaxed text-muted">{note}</p>
    </div>
  );
}

export default async function ProofPage() {
  const { towns, totals, baseline } = await computeProof();
  const num = "px-4 py-3 text-right font-mono tabular-nums";

  return (
    <>
      <AppHeader page="proof" />
      <main className="mx-auto max-w-[1200px] px-4 pb-24 pt-8 sm:px-6 sm:pt-10">
        <header className="max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">Evidence · {towns.length} host towns · recomputed on every load</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight md:text-[2.5rem]">
            Does Qloo change the plan, or would an LLM do the same?
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-muted">
            For each of {towns.length} host towns we asked the same model, with no Qloo access, to write the community plan a consultant would write,
            and froze those plans before measuring. Then we compared them with what Good Neighbor proposes from Qloo&apos;s local signals.
          </p>
        </header>

        {/* Findings */}
        <section aria-label="Findings" className="mt-8 grid gap-px overflow-hidden rounded-lg border border-rule bg-hairline md:grid-cols-2 lg:grid-cols-4">
          <Finding
            n="01"
            big={`${totals.llmVerifiedPct}%`}
            label="of the LLM's named partners are real"
            bars={[{ label: "Verified", pct: totals.llmVerifiedPct, tone: "llm" }]}
            note="Verified against Qloo or OpenStreetMap within 25 km. In well-mapped towns the LLM mostly names real institutions; in thin-data Kemmerer only 1 of 12 could be verified. Unverified is not proof of invented."
          />
          <Finding
            n="02"
            big={`${totals.llmInstitutionalPct}% vs ${totals.gnInstitutionalPct}%`}
            label="institutions: share of LLM partners vs Good Neighbor partner places"
            bars={[
              { label: "Plain LLM", pct: totals.llmInstitutionalPct, tone: "llm" },
              { label: "Good Neighbor", pct: totals.gnInstitutionalPct, tone: "gn" },
            ]}
            note="The LLM reaches for the college, the district, the library and the chamber. Qloo surfaces the places residents actually go."
          />
          <Finding
            n="03"
            big={`${totals.gnNovelPct}%`}
            label="of Good Neighbor's partner places the LLM never named"
            bars={[{ label: "Never named", pct: totals.gnNovelPct, tone: "gn" }]}
            note="Qloo isn't re-deriving what the model already knows. It adds a layer the model doesn't have."
          />
          <Finding
            n="04"
            big={`${totals.controlOwnPct}% vs ${totals.controlCrossPct}%`}
            label="negative control: right town vs wrong town"
            bars={[
              { label: "Own town", pct: totals.controlOwnPct, tone: "gn" },
              { label: "Other town", pct: totals.controlCrossPct, tone: "llm" },
            ]}
            note="Good Neighbor's partner places found in their own town's Qloo places, vs in another town's. A swapped location breaks the plan."
          />
        </section>

        {/* Template check */}
        <section className="mt-6 grid gap-5 rounded-lg border border-rule bg-paper px-5 py-5 sm:px-6 md:grid-cols-[14rem_1fr] md:items-center">
          <div>
            <h2 className="font-semibold">Template check</h2>
            <div className="mt-2 flex items-baseline gap-4 font-mono tabular-nums">
              <span>
                <span className="text-2xl font-medium">{totals.llmPlanSimilarityPct}%</span>
                <span className="ml-1 font-sans text-xs text-muted">LLM</span>
              </span>
              <span>
                <span className="text-2xl font-medium">{totals.gnPartnerOverlapPct}%</span>
                <span className="ml-1 font-sans text-xs text-muted">Good Neighbor</span>
              </span>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-muted">
            LLM plans for different towns share {totals.llmPlanSimilarityPct}% of their content words on average (town names and partner names removed).
            Good Neighbor&apos;s partner lists for different towns overlap {totals.gnPartnerOverlapPct}%. Different measures; the point is that the LLM
            writes one plan and fills in names, while the Qloo plan is built from each town.
          </p>
        </section>

        {/* By town */}
        <section aria-labelledby="by-town" className="mt-6 rounded-lg border border-rule bg-paper">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule px-5 py-4 sm:px-6">
            <h2 id="by-town" className="font-semibold">By town</h2>
            <p className="text-xs text-muted">Partner places are program items with a named local partner. Open a town to see its audit.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-hairline text-[11px] uppercase tracking-wider text-muted">
                  <th scope="col" className="sticky left-0 z-10 bg-paper px-4 py-2.5 pl-5 text-left font-medium sm:pl-6">Town</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">LLM partners named</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Verified real</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Institutions</th>
                  <th scope="col" className="border-l border-hairline px-4 py-2.5 text-right font-medium">Good Neighbor partner places</th>
                  <th scope="col" className="px-4 py-2.5 pr-6 text-right font-medium">Also named by LLM</th>
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
                    <td className={`${num} pr-6`}>{t.gnAlsoNamedByLlm}</td>
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
              <li>&ldquo;Institution&rdquo; is a keyword rule (college, school, district, library, chamber, city, county…), applied identically to both sides.</li>
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
          <div className="rounded-lg border border-amber/35 bg-paper px-5 py-5 text-sm sm:px-6">
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
