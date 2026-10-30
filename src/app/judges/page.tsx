import "../landing.css";
import "./judges.css";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { LiveDataNotice } from "@/components/LiveDataNotice";
import { PRODUCT_NAME } from "@/components/landing/brand";
import { Chevron } from "@/components/landing/Chevron";
import { CopyablePlan } from "@/components/landing/CopyablePlan";
import { heroFacts } from "@/components/landing/heroFacts";
import { Objections, objectionsFor } from "@/components/landing/Objections";
import { selectShortlist, SIMULATED_BALLOTS } from "@/lib/ballot";
import { FundBar, StruckTally, fundSplit, lineComposition } from "@/components/charts";
import { Figure } from "@/components/dashboard/Figure";
import { computeProof } from "@/lib/proof";
import { runTown } from "@/lib/run";
import { HERO_SAMPLE_ID, sampleCheckHref, samplePlanById } from "@/lib/samplePlans";
import { SpyLinks } from "@/components/ui/SpyLinks";
import { VerdictMark } from "@/components/ui";
import { isLast, ordinal, rankFill, rankInk } from "@/components/ballot/rank";
import { HERO_TOWN, TOWNS, townBySlug } from "@/lib/towns";

export const metadata: Metadata = {
  title: `Product tour · ${PRODUCT_NAME}`,
  description: `Watch a community-benefits plan get checked against its host town in five steps: the draft line by line, the costed committee memo, the resident ballot, any host town, and the evidence with its limits.`,
};

// Per request: never freeze a failed Qloo call into the page (see src/lib/qloo.ts).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Step {
  title: string;
  // A shorter label for the rail, when the title would wrap there.
  rail?: string;
  body: string;
  notice: string;
  // The step's headline figure, which the hero's overview repeats and links to.
  // "pen" when the figure counts struck lines, so it takes the struck colour.
  figure: { value: string; label: string; tone?: "pen" };
  visual: React.ReactNode;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
}

export default async function GuidedPath() {
  const [run, template, proof] = await Promise.all([
    runTown(HERO_TOWN.slug, undefined, "llm"),
    runTown(HERO_TOWN.slug, undefined, "agency"),
    computeProof(),
  ]);
  if (!run) notFound();
  const f = heroFacts(run);
  // Step 1 has to show a strike. When the AI-written draft strikes nothing, it opens the
  // consultant template instead, at its strongest swap; the kept institution stays the second link.
  const useTemplate = !f.swap && !!template;
  const first = useTemplate && template ? template : run;
  const ft = useTemplate && template ? heroFacts(template) : f;
  const firstTownHref = useTemplate ? `${f.townHref}?plan=agency` : f.townHref;
  const firstSwapHref = ft.swap ? (useTemplate ? `${firstTownHref}#line-${ft.swap.line}` : ft.swap.href) : undefined;
  const t = proof.totals;
  const heroProof = proof.towns.find((p) => p.slug === HERO_TOWN.slug);
  const town = `${HERO_TOWN.name}, ${HERO_TOWN.region}`;
  const comp = lineComposition(first.audit);
  const fund = fundSplit(run.program.items, run.program.unassigned);
  const shortlist = selectShortlist(run.program.items);
  const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  const sample = samplePlanById(HERO_SAMPLE_ID);
  const sampleHome = sample?.town ? townBySlug(sample.town) : undefined;
  const sampleTownName = sampleHome ? `${sampleHome.name}, ${sampleHome.region}` : "any town";
  const FACILITY = { "data center": "Data center", fab: "Chip fab", nuclear: "Nuclear", plant: "Plant" } as const;

  const steps: Step[] = [
    {
      title: "The draft, checked line by line",
      rail: "The draft, checked",
      figure: { value: `${comp.generic + comp.unverified} of ${comp.total}`, label: "draft lines struck", tone: comp.generic + comp.unverified > 0 ? "pen" : undefined },
      body: useTemplate
        ? `${town}, a ${HERO_TOWN.sponsor} data center campus, checked against the generic plan a consultancy might send to any town.`
        : `${town}, a ${HERO_TOWN.sponsor} data center campus. Its draft plan was written by AI alone, the way a consultant would.`,
      visual: (
        <>
          <StruckTally comp={comp} draft={useTemplate ? "Consultant template" : "AI-written draft"} />
          {/* The verdicts behind the cells, in the shared marks. */}
          <p className="gp-vis-note jg-verdicts">
            {comp.generic > 0 && (
              <span>
                <VerdictMark kind="generic" /> {comp.generic} not local
              </span>
            )}
            {comp.unverified > 0 && (
              <span>
                <VerdictMark kind="unsure" /> {comp.unverified} can&apos;t confirm
              </span>
            )}
            <span>
              <VerdictMark kind="kept" /> {comp.kept} kept
            </span>
          </p>
        </>
      ),
      notice: ft.swap
        ? `Line ${ft.swap.line} is struck: it could fit any town. In its place: ${ft.swap.title}${ft.swap.rank ? `, #${ft.swap.rank} by local affinity` : ""}. Click “Why” to see the Qloo signal.${!useTemplate && f.institution ? ` Line ${f.institution.line} keeps ${f.institution.name}: real institutions stay.` : ""}`
        : "Struck lines could fit any town; each replacement names a local place and the Qloo signal behind it.",
      primary: { href: firstSwapHref ?? firstTownHref, label: ft.swap ? `Open line ${ft.swap.line}` : "Open the check" },
      secondary: f.institution
        ? { href: f.institution.href, label: useTemplate ? "See a kept line in the AI-written draft" : "See a kept institution" }
        : undefined,
    },
    {
      title: "The committee memo",
      figure: { value: usd(run.program.totalAllocated), label: "costed, item by item" },
      body: "What a community-affairs lead takes to the committee, with a partner sheet (CSV) and a 24-month calendar (.ics).",
      visual: (
        <>
          <p className="gp-vis-v">
            <Figure value={usd(run.program.totalAllocated)} />
          </p>
          <p className="gp-vis-k">costed, item by item</p>
          <FundBar parts={fund.parts} total={fund.total} size="sm" legend={false} caption={`The ${usd(fund.total)} 24-month fund by program area`} />
          <p className="gp-vis-note">
            <span className="ch-sw ch-k-reserve" aria-hidden /> {usd(run.program.unassigned)} held in reserve
          </p>
        </>
      ),
      notice: `Commitments come first, in section 1. Every item is costed per session from the fund; the rest is held in reserve for the committee. Click Draft outreach: an OpenAI agent picks partners, confirms each on OpenStreetMap and drafts emails that name the funder (${HERO_TOWN.sponsor}).`,
      primary: { href: f.memoHref, label: "Open the memo" },
      secondary: { href: `${f.memoHref}#commitments`, label: "See section 1" },
    },
    {
      title: "Residents rank",
      figure: { value: String(shortlist.length), label: "ideas on the ballot" },
      body: "Residents put the shortlisted grants and events in order on an anonymous ballot.",
      visual: (
        <>
          <p className="gp-vis-v is-ok">
            <Figure value={String(shortlist.length)} />
          </p>
          <p className="gp-vis-k">ideas on the ballot</p>
          <ol className="gp-rank" aria-label="Ballot positions, first to last">
            {shortlist.map((it, i) => (
              <li
                key={it.id}
                className={isLast(i, shortlist.length) ? "is-outline" : undefined}
                style={{ background: rankFill(i, shortlist.length), color: rankInk(i, shortlist.length) }}
              >
                {ordinal(i + 1)}
              </li>
            ))}
          </ol>
          <p className="gp-vis-note">
            <span className="ui-chip is-warn">
              <span aria-hidden="true" className="ui-chip-dot" />
              Simulated tally
            </span>
          </p>
        </>
      ),
      notice: `The funder is named before anything is ranked. The committee tally adds ${SIMULATED_BALLOTS} simulated ballots to yours, and every screen says so.`,
      primary: { href: f.ballotHref, label: "Open the ballot" },
      secondary: { href: `${f.resultsHref}#simulated`, label: "See the tally" },
    },
    {
      title: "Any host town",
      figure: { value: String(TOWNS.length), label: "host towns ready, or type your own" },
      body: "Any US or Canadian town, with the company that funds it. The picks change because the town changes.",
      visual: (
        <>
          <p className="gp-vis-v">
            <Figure value={String(TOWNS.length)} />
          </p>
          <p className="gp-vis-k">host towns ready, or type your own</p>
          <ul className="gp-towns">
            {TOWNS.map((t) => (
              <li key={t.slug}>
                <Link href={`/town/${t.slug}`}>{t.name}</Link>
                <span>{FACILITY[t.facility]}</span>
              </li>
            ))}
          </ul>
        </>
      ),
      notice: "Taylor, Texas (a Samsung chip fab) starts from the consultant template; click “Have AI write a draft now” to watch OpenAI write one live, in about 20 seconds. Kemmerer, Wyoming shows the plan with limited local data.",
      primary: { href: "/find?q=Taylor%2C%20TX&facility=fab&company=Samsung", label: "Try Taylor, TX" },
      secondary: { href: "/town/kemmerer-wy", label: "Open Kemmerer" },
    },
    {
      title: "The evidence and its limits",
      figure: { value: `${t.llmInstitutionalPct}% vs ${t.gnInstitutionalPct}%`, label: "partners that are institutions, AI alone vs ours" },
      body: `AI alone against ${PRODUCT_NAME} in six host towns, with frozen plans and a list of what the test does not prove.`,
      visual: (
        <>
          <p className="gp-vis-k">Partners that are institutions</p>
          <div className="gp-h2h">
            <span>AI alone</span>
            <span className="gp-h2h-t">
              <span className="ch-hbar is-quiet" style={{ width: `${t.llmInstitutionalPct}%` }} />
            </span>
            <b>{t.llmInstitutionalPct}%</b>
            <span>{PRODUCT_NAME}</span>
            <span className="gp-h2h-t">
              <span className="ch-hbar" style={{ width: `${Math.max(t.gnInstitutionalPct, 1)}%` }} />
            </span>
            <b className="is-ok">{t.gnInstitutionalPct}%</b>
          </div>
          <p className="gp-vis-note">{t.gnNovelPct}% of our local partners AI alone never names.</p>
        </>
      ),
      notice: `${t.llmInstitutionalPct}% of the partners AI alone names are institutions, against ${t.gnInstitutionalPct}% of ours, and ${t.gnNovelPct}% of our local partners it never names. Ordering the same places by distance changes ${t.affinityChangedPct}% of picks${heroProof ? ` (${heroProof.gnPicksChangedByAffinity} of ${heroProof.gnPicks} in ${HERO_TOWN.name})` : ""}.`,
      primary: { href: "/proof#findings", label: "Open the evidence" },
      secondary: { href: "/proof#limits", label: "What it does not prove" },
    },
  ];

  const objections = objectionsFor(
    f,
    {
      novelPct: t.gnNovelPct,
      changedPct: t.affinityChangedPct,
      changedLine: heroProof ? `${heroProof.gnPicksChangedByAffinity} of ${heroProof.gnPicks} in ${HERO_TOWN.name}` : undefined,
    },
    HERO_TOWN.sponsor,
  );

  return (
    <div className="gn-landing jg">
      <AppHeader towns={false} page="judges" />
      <main id="main">
        <section className="gp-hero jg-hero" aria-labelledby="gp-h">
          <div className="lp-wrap jg-hero-grid">
          <div className="jg-hero-copy">
            <p className="lp-kicker">Product tour · {steps.length} steps · about 2 minutes</p>
            {/* A non-breaking hyphen keeps "community-benefits" on one line. */}
            <h1 id="gp-h" className="lp-h1 lp-h1-long">
              Watch a community‑benefits plan <span className="lp-tone">get checked against its host town.</span>
            </h1>
            <p className="lp-lede">
              {town}, home to a {HERO_TOWN.sponsor} data center campus: its draft plan checked line by line, the costed committee memo, the
              resident ballot, any town you type, then the evidence and its limits. Each step opens the live page.
            </p>
            <LiveDataNotice towns={proof.failedTowns} />
            <div className="jg-ctas">
              <Link href="#step-1" className="lp-btn lp-btn-primary">
                Follow the five steps
                <span className="lp-btn-sq" aria-hidden="true">
                  <Chevron />
                </span>
              </Link>
              <Link href="/find" className="lp-btn lp-btn-quiet">
                Find a town
              </Link>
            </div>
          </div>
          <ol className="jg-overview" aria-label="What the five steps show">
            {steps.map((s, i) => (
              <li key={s.title}>
                <a href={`#step-${i + 1}`}>
                  <span className="jg-overview-n">{i + 1}</span>
                  <span className={`jg-overview-v ${s.figure.tone ? `is-${s.figure.tone}` : ""}`}>
                    <Figure value={s.figure.value} />
                  </span>
                  <span className="jg-overview-k">{s.figure.label}</span>
                </a>
              </li>
            ))}
          </ol>
          </div>
        </section>

        <section className="gp-path" aria-label="The five steps">
          <div className="lp-wrap gp-layout">
            <nav className="gp-rail" aria-label="Steps">
              <p className="lp-kicker">The path</p>
              <ol>
                {steps.map((s, i) => (
                  <li key={s.title}>
                    <a href={`#step-${i + 1}`} data-step={i + 1} aria-label={`Step ${i + 1}: ${s.title}`}>
                      <span aria-hidden="true" />
                      {s.rail ?? s.title}
                    </a>
                  </li>
                ))}
              </ol>
              <SpyLinks current="step" />
            </nav>

            <div>
              <ol className="gp-steps">
                {steps.map((s, i) => (
                  <li key={s.title} id={`step-${i + 1}`} className="gp-step">
                    <div className="gp-step-body">
                      <p className="lp-kicker">
                        Step {i + 1} of {steps.length}
                      </p>
                      <h2 className="lp-h2">{s.title}</h2>
                      <p>{s.body}</p>
                      <p className="gp-notice">
                        <b>What to notice</b>
                        {s.notice}
                      </p>
                      <div className="lp-ctas jg-step-ctas">
                        <Link href={s.primary.href} className="lp-btn lp-btn-quiet">
                          {s.primary.label}
                          <Chevron />
                        </Link>
                        {s.secondary && (
                          <Link href={s.secondary.href} className="lp-btn lp-btn-quiet jg-link">
                            {s.secondary.label}
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="gp-vis ch-anim">{s.visual}</div>
                  </li>
                ))}
              </ol>

              {sample && (
                <div className="gp-extra">
                  <section id="own-plan" className="gp-step" aria-labelledby="own-plan-h">
                    <div className="gp-step-body">
                      <p className="lp-kicker">Optional</p>
                      <h2 id="own-plan-h" className="lp-h2">
                        Check a plan of your own
                      </h2>
                      <p>No plan to hand? Check our sample draft for {sampleTownName}: it fills the form, and you press Check this draft.</p>
                      <div className="lp-ctas jg-step-ctas">
                        <Link href={sampleCheckHref(sample.id)} className="lp-btn lp-btn-quiet">
                          Check the sample plan
                          <Chevron />
                        </Link>
                      </div>
                      <details className="ui-more">
                        <summary>Show the sample plan</summary>
                        <div>
                          <CopyablePlan text={sample.text} label={sample.label} />
                        </div>
                      </details>
                    </div>
                  </section>
                </div>
              )}

              <div className="gp-extra">
                <div className="lp-section-head">
                  <h2 className="lp-h2">
                    Fair questions, answered live.
                  </h2>
                </div>
                <Objections items={objections} />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
