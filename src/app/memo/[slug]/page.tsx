import type { Metadata } from "next";
import { shortSignal } from "@/components/ui/labels";
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
import { CalendarMenu, CrmExportLinks } from "@/components/integrations";
import { cadenceLower } from "@/components/dashboard/format";
import { AgeStrip } from "@/components/qloo/AgeStrip";
import { commitmentsFor, type CommitmentTopic } from "@/lib/commitments";
import { memoHeadlinesFor } from "@/components/landing/specs";
import { BUCKETS, type Bucket, type ProgramItem } from "@/lib/plan";
import { money, runTown } from "@/lib/run";

export const metadata: Metadata = {
  title: `Committee memo · ${PRODUCT_NAME}`,
  description: "Checks a facility's draft community plan line by line against the places the host town actually goes (Qloo taste data), and returns a costed, resident-ranked program.",
};

const MATERIAL: readonly (readonly [CommitmentTopic, string])[] = [
  ["Jobs", "Permanent roles, local-hire target, construction peak"],
  ["Power", "Who pays for grid upgrades; effect on household rates"],
  ["Water", "Cooling method, annual draw, replenishment"],
  ["Noise & light", "Limits at the fence line, monitoring"],
  ["Tax", "Abatements, PILOT payments, school-district share"],
] as const;


// One line icon per commitment topic, drawn in the topic card's colour.
const TOPIC_PATHS: Record<CommitmentTopic, string> = {
  Jobs: "M12 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20c0-3.9 3.1-7 7-7s7 3.1 7 7",
  Power: "M13 3 5 13.5h6L10 21l8-10.5h-6L13 3z",
  Water: "M12 3.5c3 4 6 7.2 6 10.5a6 6 0 0 1-12 0c0-3.3 3-6.5 6-10.5z",
  "Noise & light": "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z",
  Tax: "M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20.5h18",
};
function TopicIcon({ topic }: { topic: CommitmentTopic }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="memo-topic-i">
      <path d={TOPIC_PATHS[topic]} />
    </svg>
  );
}

// "4 sessions × $6,000": the cost basis without the partner name, which the title already carries.
const unitLine = (it: ProgramItem) => `${it.sessions} ${it.sessions === 1 ? it.unit : `${it.unit}s`} × ${money(it.unitCost)}`;

function SectionTitle({ n, children, note }: { n: string; children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="memo-section-head border-b border-ink pb-2">
      <h2 className="flex items-baseline gap-3 font-semibold tracking-tight">
        <span className="memo-section-n font-mono text-xs font-medium text-muted">{n}</span>
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
  const headlines = memoHeadlinesFor(town.slug);
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
              {MATERIAL.map(([k, hint]) => {
                const items = commitments?.items.filter((c) => c.topic === k) ?? [];
                const pick = headlines[k];
                const firstFigure = items.map((c) => splitFigures(c.text)[1]).find(Boolean);
                return (
                  <li key={k} className={items.length ? "is-cited" : "is-missing"} data-topic={k.toLowerCase()}>
                    <span className="memo-topic-head">
                      <TopicIcon topic={k} />
                      <span className="memo-topic-k">{k}</span>
                    </span>
                    {items.length ? (
                      <>
                        <span className={`memo-topic-v ${pick && !/\d/.test(pick.value) ? "is-text" : ""}`}>
                          {pick ? pick.value : firstFigure ?? items.length}
                          <span className="memo-topic-u"> {pick ? pick.unit : firstFigure ? "" : items.length === 1 ? "cited figure" : "cited figures"}</span>
                        </span>
                        <span className="memo-topic-note">{pick ? pick.note : "the first cited figure; every line is in the detail below"}</span>
                        <span className="memo-topic-n">
                          {items.length} {items.length === 1 ? "source" : "sources"}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="memo-topic-v is-missing">Not yet entered</span>
                        <span className="memo-topic-note">{hint}</span>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            {!commitments && (
              <p className="memo-cites-asof">Copy each figure from the developer&apos;s filings before this memo goes to the committee.</p>
            )}
            {commitments && (
              <div className="memo-cites mt-4">
                {MATERIAL.filter(([k]) => commitments.items.some((c) => c.topic === k)).map(([k]) => {
                  const items = commitments.items.filter((c) => c.topic === k);
                  const body = items.map((c, i) => (
                    <p key={i} className="leading-relaxed">
                      <Figures text={c.text} />{" "}
                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted underline decoration-rule underline-offset-2 [overflow-wrap:anywhere] hover:text-ink">
                        {c.source}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </p>
                  ));
                  return (
                    <div key={k} className="memo-cite">
                      <details className="memo-cite-more print:hidden">
                        <summary>
                          <span className="memo-cite-k">{k}</span>
                          <span className="memo-cite-s">
                            Sources and detail · {items.length} {items.length === 1 ? "source" : "sources"}
                          </span>
                          <Chevron className="memo-cite-c h-3.5 w-3.5" />
                        </summary>
                        <div className="memo-cite-body">{body}</div>
                      </details>
                      <div className="memo-cite-print hidden print:block">
                        <p className="memo-cite-k">{k}: sources and detail</p>
                        <div className="memo-cite-body">{body}</div>
                      </div>
                    </div>
                  );
                })}
                <p className="memo-cites-asof">
                  From public reporting as of {commitments.asOf}. Check each figure against the developer&apos;s filings before this memo goes to the committee.
                </p>
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
                    <tr className="memo-area-head">
                      <th scope="rowgroup" className="pb-1.5 pt-5 text-left font-semibold">
                        {BUCKETS[b].label}
                        <span className="ml-2 text-xs font-normal text-muted">{program.cadence[b]}</span>
                      </th>
                      <td className="pb-1.5 pt-5 text-right font-mono text-sm tabular-nums text-muted">{money(amount)}</td>
                    </tr>
                    {items.map((it) => {
                      const where = it.partner?.address;
                      const near = it.partner?.neighbouring ? (it.partner.city ?? "Neighbouring community") : undefined;
                      const ownCadence = it.cadence !== program.cadence[b] ? cadenceLower(it.cadence) : undefined;
                      return (
                        <tr key={it.id} className="memo-item align-top">
                          <td className="py-3 pr-4">
                            <div className="font-medium leading-snug">{it.title}</div>
                            <div className="memo-meta mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                              <span>{[unitLine(it), ownCadence, near, !it.partner && it.detail].filter(Boolean).join(" · ")}</span>
                              {it.partner && <span className="memo-signal font-mono text-[11px]">{shortSignal(it.provenance[0]?.signal)}</span>}
                              <CalendarMenu item={it} town={town} where={where} className="ml-auto" />
                            </div>
                            <AgeStrip ages={it.partner?.ages} className="mt-1 text-xs leading-relaxed" />
                            {where && <div className="mt-0.5 hidden text-xs text-muted print:block">{where}</div>}
                          </td>
                          <td className="memo-amount py-3 text-right font-mono tabular-nums">{money(it.amount)}</td>
                        </tr>
                      );
                    })}
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
              <details className="rp-more mt-1 print:hidden">
                <summary>How each item is costed</summary>
                <div className="mt-1">{program.costNote}</div>
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
