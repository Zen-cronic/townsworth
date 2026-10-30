import type { Metadata } from "next";
import { PRODUCT_NAME } from "@/components/landing/brand";
import { BrandMark } from "@/components/landing/BrandMark";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AgentDrafts } from "@/components/AgentDrafts";
import { AppHeader } from "@/components/AppHeader";
import { PilotLink } from "@/components/PilotLink";
import { SpyLinks } from "@/components/ui/SpyLinks";
import { FundBar, StruckTally, SessionTimeline, fundSplit, lineComposition, sessionsByBucket, splitFigures } from "@/components/charts";
import { Figure } from "@/components/dashboard/Figure";
import { Chevron, ChevronLeft, Download } from "@/components/dashboard/Icons";
import { PrintButton } from "@/components/dashboard/PrintButton";
import { EXPORT_ITEM, ExportMenu } from "@/components/ui/ExportMenu";
import { parseFund, primaryCta, secondaryCta } from "@/components/dashboard/ui";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { CrmExportLinks, SessionCalendarLinks } from "@/components/integrations";
import { AgeStrip } from "@/components/qloo/AgeStrip";
import { commitmentsFor } from "@/lib/commitments";
import { BUCKETS, costLine, type Bucket } from "@/lib/plan";
import { money, runTown } from "@/lib/run";

export const metadata: Metadata = {
  title: `Committee memo · ${PRODUCT_NAME}`,
  description: "Checks a facility's draft community plan line by line against the places the host town actually goes (Qloo taste data), and returns a costed, resident-ranked program.",
};

const MATERIAL = [
  ["Jobs", "Permanent roles, local-hire target, construction peak"],
  ["Power", "Who pays for grid upgrades; effect on household rates"],
  ["Water", "Cooling method, annual draw, replenishment"],
  ["Noise & light", "Limits at the fence line, monitoring"],
  ["Tax", "Abatements, PILOT payments, school-district share"],
] as const;


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

// Amounts in a cited commitment are set in the figure face so they can be scanned.
function Figures({ text }: { text: string }) {
  const parts = splitFigures(text);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <b key={i} className="memo-fig">
            {p}
          </b>
        ) : (
          p
        ),
      )}
    </>
  );
}

function MemoFigure({ value, label, tone, children }: { value: string; label: string; tone?: "pen" | "ok"; children?: React.ReactNode }) {
  return (
    <div className="memo-cell">
      <p className={`memo-cell-v ${tone ? `is-${tone}` : ""}`}>
        <Figure value={value} />
      </p>
      <p className="memo-cell-k">{label}</p>
      {children}
    </div>
  );
}

// Struck draft lines by reason, omitting a reason with no lines: "3 of 12 draft lines name nothing
// local; 1 names a partner that couldn't be confirmed".
function StruckSummary({ generic, unverified, total }: { generic: number; unverified: number; total: number }) {
  const verb = (n: number) => (n === 1 ? "names" : "name");
  const unconfirmed = (n: number) => `${verb(n)} a partner that couldn't be confirmed`;
  if (!generic && !unverified) return <>No draft line is struck</>;
  const lead = generic || unverified;
  return (
    <>
      <strong className="font-semibold">
        {lead} of {total}
      </strong>{" "}
      draft {total === 1 ? "line" : "lines"} {generic ? `${verb(generic)} nothing local` : unconfirmed(unverified)}
      {generic > 0 && unverified > 0 && `; ${unverified} ${unconfirmed(unverified)}`}
    </>
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
  const generic = audit.filter((a) => a.verdict === "generic").length;
  const unverified = audit.filter((a) => a.verdict === "unverified").length;
  const keptInstitutions = audit.filter((a) => a.verdict === "institution").length;
  const commitments = commitmentsFor(town.slug);
  const partnerPlaces = program.items.filter((i) => i.partner).length;
  const byBucket = (Object.keys(BUCKETS) as Bucket[])
    .map((b) => ({ b, items: program.items.filter((i) => i.bucket === b) }))
    .map((g) => ({ ...g, amount: g.items.reduce((s, i) => s + i.amount, 0) }));
  const comp = lineComposition(audit);
  const fundParts = fundSplit(program.items, program.unassigned);
  const sessions = sessionsByBucket(program.items);
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
      <main id="main" className="relative mx-auto max-w-[960px] px-4 pb-24 pt-8 sm:px-8 sm:pt-10">
        {/* Contents, in the left margin on wide screens only; never printed. Numbered like the memo. */}
        <nav aria-label="Memo contents" className="no-print absolute right-full top-0 mr-6 hidden h-full w-40 min-[1360px]:block">
          <div className="sticky top-[calc(var(--l-hdr,64px)+40px)] pt-[7.5rem]">
            <p className="text-xs font-semibold text-muted">Contents</p>
            <ol className="mt-2 grid gap-0.5 text-sm">
              {[
                ["commitments", "1", "Material commitments"],
                ["program", "2", "The program"],
                ["guardrails", "3", "Guardrails"],
              ].map(([id, n, label]) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="flex min-h-9 items-baseline gap-2 rounded-md py-1.5 text-muted transition-colors duration-150 hover:text-ink aria-[current]:font-medium aria-[current]:text-ink"
                  >
                    <span className="font-mono text-xs tabular-nums">{n}</span>
                    {label}
                  </a>
                </li>
              ))}
            </ol>
            <SpyLinks current="location" />
          </div>
        </nav>
        <div className="no-print mb-4 grid gap-3">
          <Link
            href={`/town/${town.slug}?fund=${program.annualFund}`}
            className="inline-flex w-fit items-center gap-1 rounded-md py-1.5 pr-2 text-sm text-muted transition-colors duration-150 hover:text-ink"
          >
            <ChevronLeft />
            Back to the audit
          </Link>
          {/* Exports line up with the memo's left edge */}
          <span className="flex flex-wrap items-start gap-2">
            <PrintButton className={primaryCta} />
            <ExportMenu>
                <a href={`${exportBase}&format=csv`} className={EXPORT_ITEM}>
                  <Download />
                  Partner sheet (CSV)
                </a>
                <a href={`${exportBase}&format=ics`} className={EXPORT_ITEM}>
                  <Download />
                  Calendar (.ics)
                </a>
                <CrmExportLinks slug={town.slug} fund={program.annualFund} linkClassName={EXPORT_ITEM} />
              </ExportMenu>
          </span>
        </div>

        <article className="doc-sheet rounded-md px-5 py-7 sm:px-12 sm:py-11">
          {/* Letterhead */}
          <header>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <BrandMark size={18} />
                {PRODUCT_NAME}
              </p>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted">Community commitments memo</span>
                <StatusPill tone="warn">Draft for committee review</StatusPill>
              </div>
            </div>
            <h1 className="mt-8 text-balance text-2xl font-semibold leading-tight tracking-tight sm:text-[1.75rem]">
              <span className="block">{town.name}, {town.region}</span>
              <span className="block text-muted">24-month community investment program</span>
            </h1>
            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-y border-hairline py-4 text-sm sm:grid-cols-3">
              {meta.map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="mt-0.5 leading-snug">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="memo-figs mt-6">
              <div className="memo-cell">
                <StruckTally comp={comp} draft="AI-written draft" />
              </div>
              <MemoFigure value={String(program.items.length)} label={`program items, ${partnerPlaces} with a local partner`} tone="ok" />
              <MemoFigure value={money(program.totalAllocated)} label="itemized over 24 months" />
              <MemoFigure value={money(program.unassigned)} label="held in reserve for the committee" />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              <StruckSummary generic={generic} unverified={unverified} total={audit.length} />
              {keptInstitutions > 0 && `; ${keptInstitutions} ${keptInstitutions === 1 ? "institution stays" : "institutions stay"} for the committee to confirm`}.
            </p>
          </header>

          {/* Material commitments */}
          <section id="commitments" className="mt-10 scroll-mt-24">
            <SectionTitle n="1" note="The cultural program below is in addition to these, never instead of them.">
              Material commitments, from the developer&apos;s filings
            </SectionTitle>
            <ul className="memo-topics mt-4" aria-label="Material commitments by topic">
              {MATERIAL.map(([k]) => {
                const n = commitments?.items.filter((c) => c.topic === k).length ?? 0;
                return (
                  <li key={k} className={n ? "is-cited" : "is-missing"}>
                    <span className="memo-topic-k">{k}</span>
                    <span className="memo-topic-v">{n ? n : "–"}</span>
                    <span className="memo-topic-n">{n ? (n === 1 ? "cited figure" : "cited figures") : "not yet entered"}</span>
                  </li>
                );
              })}
            </ul>
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
                            <Figures text={c.text} />{" "}
                            <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted underline decoration-rule underline-offset-2 [overflow-wrap:anywhere] hover:text-ink">
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
          <section id="program" className="mt-10 scroll-mt-24">
            <SectionTitle n="2" note={`${program.items.length} program items across ${byBucket.filter((g) => g.items.length).length} areas; ${partnerPlaces} name a local partner.`}>
              The program
            </SectionTitle>
            <div className="mt-5">
              <FundBar parts={fundParts.parts} total={fundParts.total} caption={`The ${money(fundParts.total)} 24-month fund by program area`} />
            </div>
            {sessions.length > 0 && (
              <div className="mt-6 break-inside-avoid border-t border-hairline pt-4">
                <h3 className="text-sm font-semibold">Sessions over the 24 months</h3>
                <div className="mt-3">
                  <SessionTimeline rows={sessions} />
                </div>
              </div>
            )}

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
                            <span className="ml-2 inline-block font-mono text-[11px] text-muted/90">{it.provenance[0]?.signal}</span>
                          </div>
                          <AgeStrip ages={it.partner?.ages} className="mt-0.5 text-xs leading-relaxed" />
                          <SessionCalendarLinks item={it} town={town} firstOnly className="mt-1" />
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums">{money(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              <tbody className="border-b border-hairline">
                <tr className="align-top">
                  <th scope="row" className="py-3 pr-4 text-left font-normal">
                    <div className="font-semibold">Reserve, for the committee</div>
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
                      {money(program.totalAllocated)} itemized + {money(program.unassigned)} in reserve
                    </span>
                  </th>
                  <td className="pt-3 text-right font-mono font-medium tabular-nums">{money(program.totalAllocated + program.unassigned)}</td>
                </tr>
              </tfoot>
            </table>

            <div id="fund-note" className="mt-6 scroll-mt-24 border-l border-rule pl-3 text-xs leading-relaxed text-muted">
              <p>
                <strong className="font-semibold text-ink">Annual fund {money(program.annualFund)}.</strong> {town.fundNote}
              </p>
              <details className="ui-more mt-1 print:hidden">
                <summary>How each item is costed</summary>
                <div>{program.costNote}</div>
              </details>
              <p className="mt-1 hidden print:block">
                <strong className="font-semibold text-ink">How each item is costed.</strong> {program.costNote}
              </p>
            </div>
          </section>

          {/* Guardrails */}
          <section id="guardrails" className="mt-10 scroll-mt-24">
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
            <p className="no-print mt-6 text-sm text-muted">
              Want this for your project?{" "}
              <PilotLink
                townName={town.name}
                className="font-medium text-ink underline decoration-rule underline-offset-4 transition-colors duration-150 hover:decoration-ink"
              />
            </p>
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
