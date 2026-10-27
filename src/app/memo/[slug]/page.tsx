import Link from "next/link";
import { notFound } from "next/navigation";
import { AgentDrafts } from "@/components/AgentDrafts";
import { AppHeader } from "@/components/AppHeader";
import { AllocationBar } from "@/components/dashboard/AllocationBar";
import { Chevron, ChevronLeft, Download } from "@/components/dashboard/Icons";
import { PrintButton } from "@/components/dashboard/PrintButton";
import { parseFund, secondaryCta } from "@/components/dashboard/ui";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { isKept } from "@/lib/audit";
import { commitmentsFor } from "@/lib/commitments";
import { BUCKETS, costLine, type Bucket } from "@/lib/plan";
import { money, runTown } from "@/lib/run";

const MATERIAL = [
  ["Jobs", "Permanent roles, local-hire target, construction peak"],
  ["Power", "Who pays for grid upgrades; effect on household rates"],
  ["Water", "Cooling method, annual draw, replenishment"],
  ["Noise & light", "Limits at the fence line, monitoring"],
  ["Tax", "Abatements, PILOT payments, school-district share"],
] as const;

const toolButton =
  "inline-flex items-center gap-1.5 rounded-md border border-rule bg-paper px-3 py-1.5 text-sm transition-colors duration-150 hover:border-ink active:bg-concrete";

function SectionTitle({ n, children, note }: { n: string; children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="border-b border-ink pb-2">
      <h2 className="flex items-baseline gap-3 font-semibold tracking-tight">
        <span className="font-mono text-xs font-medium text-muted">{n}</span>
        {children}
      </h2>
      {note && <p className="mt-0.5 pl-7 text-sm text-muted">{note}</p>}
    </div>
  );
}

export default async function MemoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ fund?: string }>;
}) {
  const [{ slug }, { fund }] = await Promise.all([params, searchParams]);
  const run = await runTown(slug, parseFund(fund));
  if (!run) notFound();
  const { town, program, profile, audit } = run;
  const flagged = audit.filter((a) => !isKept(a.verdict)).length;
  const keptInstitutions = audit.filter((a) => a.verdict === "institution").length;
  const commitments = commitmentsFor(town.slug);
  const partnerPlaces = program.items.filter((i) => i.partner).length;
  const byBucket = (Object.keys(BUCKETS) as Bucket[])
    .map((b) => ({ b, items: program.items.filter((i) => i.bucket === b) }))
    .map((g) => ({ ...g, amount: g.items.reduce((s, i) => s + i.amount, 0) }));
  const exportBase = `/api/export/${town.slug}?fund=${program.annualFund}`;
  const prepared = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Toronto" }).format(new Date());

  const meta: [string, React.ReactNode][] = [
    ["Prepared for", "The community committee"],
    ["Host community", `${town.name}, ${town.region}`],
    ["Facility", town.project],
    ["Term", "24 months"],
    ["Annual fund", <span key="f" className="font-mono tabular-nums">{money(program.annualFund)}</span>],
    ["Prepared", prepared],
  ];

  return (
    <>
      <AppHeader active={slug} />
      <main className="mx-auto max-w-[920px] px-4 pb-24 pt-6 sm:px-6 sm:pt-8">
        <div className="no-print mb-4 flex flex-wrap items-center gap-2">
          <Link
            href={`/town/${town.slug}?fund=${program.annualFund}`}
            className="inline-flex items-center gap-1 rounded-md py-1.5 pr-2 text-sm text-muted transition-colors duration-150 hover:text-ink"
          >
            <ChevronLeft />
            Back to the audit
          </Link>
          <span className="ml-auto flex flex-wrap gap-2">
            <a href={`${exportBase}&format=csv`} className={toolButton}>
              <Download />
              Partner sheet (CSV)
            </a>
            <a href={`${exportBase}&format=ics`} className={toolButton}>
              <Download />
              Calendar (.ics)
            </a>
            <PrintButton className={toolButton} />
          </span>
        </div>

        <article className="doc-sheet rounded-md px-5 py-7 sm:px-12 sm:py-11">
          {/* Letterhead */}
          <header>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <span aria-hidden className="grid h-4 w-4 place-items-center rounded-[3px] bg-hivis">
                  <span className="h-[2px] w-2 rounded-full bg-paper" />
                </span>
                Good Neighbor
              </p>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted">Community commitments memo</span>
                <StatusPill tone="warn">Draft for committee review</StatusPill>
              </div>
            </div>
            <h1 className="mt-8 text-balance text-2xl font-semibold leading-tight tracking-tight sm:text-[1.75rem]">
              <span className="block">{town.name}, {town.region}</span>
              <span className="block text-muted">24-month good-neighbor program</span>
            </h1>
            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-y border-hairline py-4 text-sm sm:grid-cols-3">
              {meta.map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="mt-0.5 leading-snug">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 leading-relaxed">
              The draft plan had <strong className="font-semibold">{flagged} of {audit.length}</strong> items that name nothing local or a partner
              that can&apos;t be verified.
              {keptInstitutions > 0 &&
                ` ${keptInstitutions} ${keptInstitutions === 1 ? "institution it names stays" : "institutions it names stay"} in, for the committee to confirm.`}{" "}
              This memo sets out <strong className="font-semibold">{program.items.length} program items</strong> ({partnerPlaces} with a named local
              partner place) grounded in {town.name}&apos;s Qloo signals and costed per session:{" "}
              <strong className="font-mono font-medium tabular-nums">{money(program.totalAllocated)}</strong> itemized, and{" "}
              <strong className="font-mono font-medium tabular-nums">{money(program.unassigned)}</strong> left for the committee to allocate, of the{" "}
              {money(program.twoYearFund)} 24-month fund. Sponsor-labeled; prepared with aggregate Qloo signals.
            </p>
          </header>

          {/* Material commitments */}
          <section className="mt-10">
            <SectionTitle n="1" note="The cultural program below is in addition to these, never instead of them.">
              Material commitments, from the developer&apos;s filings
            </SectionTitle>
            {commitments && (
              <dl className="mt-4 divide-y divide-hairline rounded-md border border-hairline text-sm">
                {MATERIAL.filter(([k]) => commitments.items.some((c) => c.topic === k)).map(([k]) => (
                  <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[6.5rem_1fr] sm:gap-3 sm:px-5">
                    <dt className="font-medium">{k}</dt>
                    <dd className="space-y-1.5">
                      {commitments.items
                        .filter((c) => c.topic === k)
                        .map((c, i) => (
                          <p key={i} className="leading-relaxed">
                            {c.text}{" "}
                            <a href={c.url} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap text-xs text-muted underline decoration-rule underline-offset-2 hover:text-ink">
                              {c.source}
                            </a>
                          </p>
                        ))}
                    </dd>
                  </div>
                ))}
                <p className="px-4 py-2 text-[11px] text-muted sm:px-5">
                  From public reporting as of {commitments.asOf}. Check each figure against the developer&apos;s filings before this memo goes to the committee.
                </p>
              </dl>
            )}
            {MATERIAL.some(([k]) => !commitments?.items.some((c) => c.topic === k)) && (
              <div className="mt-4 rounded-md border border-dashed border-amber/50 bg-amber-wash/40 px-4 py-4 sm:px-5">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  Not yet entered
                  <span className="text-xs font-normal text-muted">Copy each figure from the developer&apos;s filings before this memo goes to the committee.</span>
                </p>
                <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                  {MATERIAL.filter(([k]) => !commitments?.items.some((c) => c.topic === k)).map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[6.5rem_1fr] gap-2">
                      <dt className="font-medium">{k}</dt>
                      <dd className="text-muted">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </section>

          {/* Program */}
          <section className="mt-10">
            <SectionTitle n="2" note={`${program.items.length} program items across ${byBucket.filter((g) => g.items.length).length} areas; ${partnerPlaces} name a local partner place.`}>
              The program
            </SectionTitle>
            <div className="mt-4">
              <AllocationBar totals={byBucket.map(({ b, amount }) => ({ b, amount }))} total={program.totalAllocated} />
            </div>

            <table className="mt-6 w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-[11px] uppercase tracking-wider text-muted">
                  <th className="pb-2 font-medium">Item</th>
                  <th className="pb-2 text-right font-medium">Item budget</th>
                </tr>
              </thead>
              {byBucket
                .filter((g) => g.items.length)
                .map(({ b, items, amount }) => (
                  <tbody key={b} className="border-b border-hairline">
                    <tr>
                      <th scope="rowgroup" className="pb-1.5 pt-5 text-left font-semibold">
                        {BUCKETS[b].label}
                        <span className="ml-2 text-xs font-normal text-muted">{program.cadence[b]}</span>
                      </th>
                      <td className="pb-1.5 pt-5 text-right font-mono text-sm tabular-nums text-muted">{money(amount)}</td>
                    </tr>
                    {items.map((it) => (
                      <tr key={it.id} className="align-top">
                        <td className="py-2 pr-4">
                          <div className="leading-snug">{it.title}</div>
                          <div className="mt-0.5 text-xs leading-relaxed text-muted">
                            {costLine(it)} · {it.cadence}
                            {it.partner?.neighbouring && ` · Neighbouring community${it.partner.city ? ` (${it.partner.city})` : ""}`}
                          </div>
                          <div className="text-xs leading-relaxed text-muted">
                            {it.partner?.address ?? it.detail}
                            <span className="ml-2 whitespace-nowrap font-mono text-[11px] text-muted/90">{it.provenance[0]?.signal}</span>
                          </div>
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums">{money(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              <tbody className="border-b border-hairline">
                <tr className="align-top">
                  <th scope="row" className="py-3 pr-4 text-left font-normal">
                    <div className="font-semibold">Unassigned, for the committee to allocate</div>
                    <div className="mt-0.5 text-xs font-normal text-muted">
                      Not itemized by this tool: more grant cycles, larger awards or items residents add. The committee decides.
                    </div>
                  </th>
                  <td className="py-3 text-right font-mono tabular-nums">{money(program.unassigned)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink">
                  <th scope="row" className="pt-3 text-left font-semibold">
                    Total over 24 months
                    <span className="ml-2 text-xs font-normal text-muted">
                      {money(program.totalAllocated)} itemized + {money(program.unassigned)} unassigned
                    </span>
                  </th>
                  <td className="pt-3 text-right font-mono font-medium tabular-nums">{money(program.totalAllocated + program.unassigned)}</td>
                </tr>
              </tfoot>
            </table>

            <p className="mt-6 border-l-2 border-rule pl-3 text-xs leading-relaxed text-muted">
              <strong className="font-semibold text-ink">Where the numbers come from.</strong> Annual fund: {money(program.annualFund)} (
              {town.fundNote}). {program.costNote}
            </p>
          </section>

          {/* Guardrails */}
          <section className="mt-10">
            <SectionTitle n="3">Guardrails</SectionTitle>
            <ol className="mt-3 space-y-2 text-sm leading-relaxed">
              {[
                "Not persuasion: no item is timed to a vote, hearing or permit decision.",
                "Residents rank the grant shortlist in an anonymous ballot; the community committee decides. No resident data is sent to Qloo.",
                `No political, religious or identity targeting. ${profile.excluded.length} Qloo ${profile.excluded.length === 1 ? "result was" : "results were"} excluded by rule.`,
                "Signals describe aggregate local affinities, not individual people. Partner availability is not yet confirmed.",
              ].map((g, i) => (
                <li key={g} className="grid grid-cols-[1.75rem_1fr]">
                  <span className="font-mono text-xs leading-6 text-muted">3.{i + 1}</span>
                  <span>{g}</span>
                </li>
              ))}
            </ol>
            <div className="no-print mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-hairline bg-concrete/60 px-4 py-3">
              <Link href={`/ballot/${town.slug}`} className={secondaryCta}>
                Send the shortlist to residents
                <Chevron />
              </Link>
              <span className="text-xs leading-relaxed text-muted">Opens the anonymous resident ballot and a simulated committee tally.</span>
            </div>
          </section>

          <footer className="mt-12 flex flex-wrap justify-between gap-2 border-t border-hairline pt-4 text-[11px] text-muted">
            <span>Draft for discussion. Not reviewed or adopted by the committee.</span>
            <span className="font-mono">{town.name} · {prepared}</span>
          </footer>
        </article>

        <AgentDrafts slug={town.slug} fund={program.annualFund} />
      </main>
    </>
  );
}
