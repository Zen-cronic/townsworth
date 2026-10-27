import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { computeProof } from "@/lib/proof";

export const dynamic = "force-dynamic";

function Finding({ big, label, note }: { big: string; label: string; note: string }) {
  return (
    <div className="rounded-lg border border-rule bg-paper p-5">
      <div className="font-mono text-3xl font-medium tabular-nums">{big}</div>
      <div className="mt-1 font-medium leading-snug">{label}</div>
      <p className="mt-2 text-sm text-muted">{note}</p>
    </div>
  );
}

export default async function ProofPage() {
  const { towns, totals, baseline } = await computeProof();
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-6xl px-5 pb-24 pt-8">
        <p className="font-mono text-xs uppercase tracking-wide text-muted">Proof · recomputed on every load</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Does Qloo change the plan, or would an LLM do the same?</h1>
        <p className="mt-2 max-w-3xl text-muted">
          For each of six host towns we asked the same model, with no Qloo access, to write the community plan a consultant would write, and froze
          those plans before measuring. Then we compared them with what Good Neighbor proposes from Qloo&apos;s local signals.
        </p>

        <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Finding
            big={`${totals.llmVerifiedPct}%`}
            label="of the LLM's named partners are real"
            note="Verified against Qloo or OpenStreetMap within 25 km. In well-mapped towns the LLM mostly names real institutions; in thin-data Kemmerer only 1 of 12 could be verified. Unverified is not proof of invented."
          />
          <Finding
            big={`${totals.llmInstitutionalPct}% vs ${totals.gnInstitutionalPct}%`}
            label="institutions: LLM partners vs Good Neighbor partners"
            note="The LLM reaches for the college, the district, the library and the chamber. Qloo surfaces the places residents actually go."
          />
          <Finding
            big={`${totals.gnNovelPct}%`}
            label="of Good Neighbor's partners the LLM never named"
            note="Qloo isn't re-deriving what the model already knows. It adds a layer the model doesn't have."
          />
          <Finding
            big={`${totals.controlOwnPct}% vs ${totals.controlCrossPct}%`}
            label="negative control: right town vs wrong town"
            note="Good Neighbor's partners found in their own town's Qloo places, vs in another town's. A swapped location breaks the plan."
          />
        </section>

        <section className="mt-6 rounded-lg border border-rule bg-paper p-5">
          <h2 className="font-semibold">Template check</h2>
          <p className="mt-1 text-sm text-muted">
            LLM plans for different towns share {totals.llmPlanSimilarityPct}% of their content words on average (town names and partner names
            removed). Good Neighbor&apos;s partner lists for different towns overlap {totals.gnPartnerOverlapPct}%. Different measures; the point is that
            the LLM writes one plan and fills in names, while the Qloo plan is built from each town.
          </p>
        </section>

        <section className="mt-6 overflow-x-auto rounded-lg border border-rule bg-paper">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-rule text-left text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Town</th>
                <th className="px-4 py-2 font-medium">LLM partners named</th>
                <th className="px-4 py-2 font-medium">Verified real</th>
                <th className="px-4 py-2 font-medium">Institutions</th>
                <th className="px-4 py-2 font-medium">Good Neighbor partners</th>
                <th className="px-4 py-2 font-medium">Also named by LLM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline font-mono tabular-nums">
              {towns.map((t) => (
                <tr key={t.slug}>
                  <td className="px-4 py-2 font-sans">
                    <Link className="underline decoration-rule underline-offset-2 hover:decoration-ink" href={`/town/${t.slug}`}>{t.name}</Link>
                    {t.thin && <span className="ml-2 rounded bg-amber-wash px-1.5 py-0.5 font-sans text-xs text-amber">thin data</span>}
                  </td>
                  <td className="px-4 py-2">{t.llmNamed}</td>
                  <td className="px-4 py-2">{t.llmVerified}</td>
                  <td className="px-4 py-2">{t.llmInstitutional}</td>
                  <td className="px-4 py-2">{t.gnPartners}</td>
                  <td className="px-4 py-2">{t.gnAlsoNamedByLlm}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-rule bg-paper p-5 text-sm">
            <h2 className="font-semibold">How this was run</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
              <li>Baseline: OpenAI {baseline.model}, prompt {baseline.promptVersion}, frozen {baseline.createdAt.slice(0, 10)}.</li>
              <li className="break-all">SHA-256 of the frozen file: <span className="font-mono">{baseline.sha256}</span></li>
              <li>Good Neighbor: live Qloo Insights calls (places within 15 km, plus local taste), with the same deterministic rules for every town.</li>
              <li>&ldquo;Institution&rdquo; is a keyword rule (college, school, district, library, chamber, city, county…), applied identically to both sides.</li>
            </ul>
          </div>
          <div className="rounded-lg border border-rule bg-paper p-5 text-sm">
            <h2 className="font-semibold">What this does not prove</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
              <li>That residents value a Qloo-grounded program more, or that it changes attendance or acceptance.</li>
              <li>Six towns and one model: a directional check, not a statistical study.</li>
              <li>Institutions are good partners too. The claim is that the LLM finds only them, not that they are wrong.</li>
              <li>A partner&apos;s availability or willingness is not confirmed by either arm.</li>
            </ul>
          </div>
        </section>
      </main>
    </>
  );
}
