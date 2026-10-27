import Link from "next/link";
import { notFound } from "next/navigation";
import { AgentDrafts } from "@/components/AgentDrafts";
import { AppHeader } from "@/components/AppHeader";
import { BUCKETS, type Bucket } from "@/lib/plan";
import { money, runTown } from "@/lib/run";

const MATERIAL = [
  ["Jobs", "Permanent roles, local-hire target, construction peak"],
  ["Power", "Who pays for grid upgrades; effect on household rates"],
  ["Water", "Cooling method, annual draw, replenishment"],
  ["Noise & light", "Limits at the fence line, monitoring"],
  ["Tax", "Abatements, PILOT payments, school-district share"],
];

export default async function MemoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ fund?: string }>;
}) {
  const [{ slug }, { fund }] = await Promise.all([params, searchParams]);
  const run = await runTown(slug, Number(fund) || undefined);
  if (!run) notFound();
  const { town, program, profile, audit } = run;
  const flagged = audit.filter((a) => a.verdict !== "grounded").length;
  const byBucket = (Object.keys(BUCKETS) as Bucket[]).map((b) => ({ b, items: program.items.filter((i) => i.bucket === b) }));
  const exportBase = `/api/export/${town.slug}?fund=${program.annualFund}`;

  return (
    <>
      <AppHeader active={slug} />
      <main className="mx-auto max-w-4xl px-5 pb-24 pt-8">
        <div className="no-print mb-4 flex flex-wrap gap-2 text-sm">
          <Link href={`/town/${town.slug}?fund=${program.annualFund}`} className="text-muted hover:text-ink">← Back to the audit</Link>
          <span className="ml-auto flex gap-2">
            <a href={`${exportBase}&format=csv`} className="rounded-md border border-rule bg-paper px-3 py-1.5 hover:border-ink">Partner sheet (CSV)</a>
            <a href={`${exportBase}&format=ics`} className="rounded-md border border-rule bg-paper px-3 py-1.5 hover:border-ink">Calendar (.ics)</a>
          </span>
        </div>

        <article className="rounded-lg border border-rule bg-paper p-8 shadow-sm print:border-0 print:shadow-none">
          <header className="border-b border-rule pb-5">
            <p className="font-mono text-xs uppercase tracking-wide text-muted">Community commitments memo · draft for the community committee</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              {town.name}, {town.region}: 24-month good-neighbour program
            </h1>
            <p className="mt-2 text-sm text-muted">{town.project}. Sponsor-labelled; prepared with Good Neighbor using aggregate Qloo signals.</p>
          </header>

          <section className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">1 · Material commitments (from the developer&apos;s filings)</h2>
            <p className="mt-1 text-sm text-muted">The cultural program below is in addition to these, never instead of them.</p>
            <dl className="mt-3 divide-y divide-hairline rounded-md border border-hairline">
              {MATERIAL.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[8rem_1fr_auto] items-center gap-3 px-4 py-2 text-sm">
                  <dt className="font-medium">{k}</dt>
                  <dd className="text-muted">{v}</dd>
                  <dd className="rounded bg-amber-wash px-2 py-0.5 text-xs text-amber">Enter from filings</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">2 · The program</h2>
            <p className="mt-1 text-sm text-muted">
              The agency draft had {flagged} of {audit.length} items that name nothing local. This program replaces them with {program.items.length} items grounded in{" "}
              {town.name}&apos;s Qloo signals.
            </p>
            {byBucket.filter((g) => g.items.length).map(({ b, items }) => (
              <div key={b} className="mt-5">
                <h3 className="flex items-baseline justify-between border-b border-hairline pb-1 font-medium">
                  {BUCKETS[b].label}
                  <span className="font-mono text-sm tabular-nums text-muted">{money(items.reduce((s, i) => s + i.amount, 0))}</span>
                </h3>
                <ul className="mt-2 space-y-2 text-sm">
                  {items.map((it) => (
                    <li key={it.id} className="grid grid-cols-[1fr_auto] gap-3">
                      <div>
                        <div>{it.title}</div>
                        <div className="text-xs text-muted">
                          {it.partner?.address ?? it.detail}
                          {it.partner?.distanceKm != null ? ` · ${it.partner.distanceKm} km` : ""}
                          {" · "}
                          <span className="font-mono">{it.provenance[0]?.signal}</span>
                        </div>
                      </div>
                      <div className="font-mono tabular-nums">{money(it.amount)}</div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="mt-4 rounded-md bg-concrete px-3 py-2 text-xs text-muted">
              <strong className="text-ink">Where the numbers come from.</strong> Annual fund: {money(program.annualFund)} ({town.fundNote}). {program.costNote}
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">3 · Guardrails</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              <li>Not persuasion: no item is timed to a vote, hearing or permit decision.</li>
              <li>Residents rank the grant shortlist in an anonymous ballot; the community committee decides. No resident data is sent to Qloo.</li>
              <li>No political, religious or identity targeting. {profile.excluded.length} Qloo {profile.excluded.length === 1 ? "result was" : "results were"} excluded by rule.</li>
              <li>Signals describe aggregate local affinities, not individual people. Partner availability is not yet confirmed.</li>
            </ul>
          </section>
        </article>

        <AgentDrafts slug={town.slug} fund={program.annualFund} />
      </main>
    </>
  );
}
