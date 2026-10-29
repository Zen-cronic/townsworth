import "../landing.css";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { LiveDataNotice } from "@/components/LiveDataNotice";
import { PRODUCT_NAME } from "@/components/landing/brand";
import { Chevron } from "@/components/landing/Chevron";
import { heroFacts } from "@/components/landing/heroFacts";
import { Objections, objectionsFor } from "@/components/landing/Objections";
import { selectShortlist, SIMULATED_BALLOTS } from "@/lib/ballot";
import { FundBar, LineStrip, fundSplit, lineComposition } from "@/components/charts";
import { Figure } from "@/components/dashboard/Figure";
import { computeProof } from "@/lib/proof";
import { runTown } from "@/lib/run";
import { HERO_TOWN, TOWNS } from "@/lib/towns";

export const metadata: Metadata = {
  title: `Guided path · ${PRODUCT_NAME}`,
  description: `See ${PRODUCT_NAME} work in two minutes: a finished example, the committee memo, the resident ballot, any host town, and the evidence with its limits.`,
};

// Per request: never freeze a failed Qloo call into the page (see src/lib/qloo.ts).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Step {
  title: string;
  body: string;
  notice: string;
  visual: React.ReactNode;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
}

export default async function GuidedPath() {
  const [run, proof] = await Promise.all([runTown(HERO_TOWN.slug, undefined, "llm"), computeProof()]);
  if (!run) notFound();
  const f = heroFacts(run);
  const t = proof.totals;
  const heroProof = proof.towns.find((p) => p.slug === HERO_TOWN.slug);
  const town = `${HERO_TOWN.name}, ${HERO_TOWN.region}`;
  const comp = lineComposition(run.audit);
  const fund = fundSplit(run.program.items, run.program.unassigned);
  const shortlist = selectShortlist(run.program.items);
  const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  const FACILITY = { "data center": "Data center", fab: "Chip fab", nuclear: "Nuclear", plant: "Plant" } as const;

  const steps: Step[] = [
    {
      title: "The draft, checked line by line",
      body: `${town}, a ${HERO_TOWN.sponsor} data center campus. Its draft plan was written by AI alone, the way a consultant would.`,
      visual: (
        <>
          <p className="gp-vis-v is-ok">
            <Figure value={`${comp.kept} of ${comp.total}`} />
          </p>
          <p className="gp-vis-k">draft lines kept</p>
          <LineStrip comp={comp} size="sm" />
        </>
      ),
      notice: f.swap
        ? `Line ${f.swap.line} is struck: it could fit any town. In its place: ${f.swap.title}${f.swap.rank ? `, #${f.swap.rank} by local affinity` : ""}. Click “Why” to see the Qloo signal.${f.institution ? ` Line ${f.institution.line} keeps ${f.institution.name}: real institutions stay.` : ""}`
        : "Struck lines could fit any town; each replacement names a local place and the Qloo signal behind it.",
      primary: { href: f.swap?.href ?? f.townHref, label: f.swap ? `Open line ${f.swap.line}` : "Open the check" },
      secondary: f.institution ? { href: f.institution.href, label: "See a kept institution" } : undefined,
    },
    {
      title: "The committee memo",
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
      body: "Residents put the shortlisted grants and events in order on an anonymous ballot.",
      visual: (
        <>
          <p className="gp-vis-v is-ok">
            <Figure value={String(shortlist.length)} />
          </p>
          <p className="gp-vis-k">ideas on the ballot</p>
          <ol className="gp-rank" aria-label="Ballot positions, first to last">
            {shortlist.map((it, i) => (
              <li key={it.id} style={{ background: `color-mix(in srgb, var(--ok) ${i === 0 ? 100 : Math.round(55 - ((i - 1) / Math.max(shortlist.length - 2, 1)) * 35)}%, var(--paper))` }}>
                <span className={i === 0 ? "is-dark" : ""}>{i === 0 ? "1st" : i === 1 ? "2nd" : i === 2 ? "3rd" : `${i + 1}th`}</span>
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
    <div className="gn-landing">
      <AppHeader page="judges" />
      <main>
        <section className="gp-hero lp-grain" aria-labelledby="gp-h">
          <div className="lp-wrap">
            <p className="lp-kicker">Guided path · two minutes · nothing to sign up for</p>
            <h1 id="gp-h" className="lp-h1">
              See it work <span className="lp-tone">in two minutes.</span>
            </h1>
            <p className="lp-lede">
              Five steps through a finished example, then a town of your choice. Every step opens the live product at the exact line
              that matters.
            </p>
            <LiveDataNotice towns={proof.failedTowns} />
            <div className="gp-entrances">
              <Link href="#step-1" className="gp-entry is-primary">
                <span className="lp-kicker">Start here</span>
                <span className="gp-entry-t">
                  Follow the five steps <Chevron />
                </span>
                <p>Begins with {town}, already checked line by line.</p>
              </Link>
              <Link href="/find" className="gp-entry">
                <span className="lp-kicker">Or jump in</span>
                <span className="gp-entry-t">
                  Try any host town <Chevron />
                </span>
                <p>Type a US or Canadian town and the company funding its program.</p>
              </Link>
            </div>
          </div>
        </section>

        <section className="gp-path" aria-label="The five steps">
          <div className="lp-wrap gp-layout">
            <nav className="gp-rail" aria-label="Steps">
              <p className="lp-kicker">The path</p>
              <ol>
                {steps.map((s, i) => (
                  <li key={s.title}>
                    <a href={`#step-${i + 1}`}>
                      <span aria-hidden="true" />
                      {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <div>
              <ol className="gp-steps">
                {steps.map((s, i) => (
                  <li key={s.title} id={`step-${i + 1}`} className="gp-step">
                    <div className="gp-step-body">
                      <h2 className="lp-h2">{s.title}</h2>
                      <p>{s.body}</p>
                      <p className="gp-notice">
                        <b>What to notice</b>
                        {s.notice}
                      </p>
                      <div className="lp-ctas">
                        <Link href={s.primary.href} className="lp-btn lp-btn-primary">
                          {s.primary.label}
                          <span className="lp-btn-sq" aria-hidden="true">
                            <Chevron />
                          </span>
                        </Link>
                        {s.secondary && (
                          <Link href={s.secondary.href} className="lp-btn lp-btn-quiet">
                            {s.secondary.label}
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className={`gp-vis ch-anim ${i === steps.length - 1 ? "is-band" : ""}`}>{s.visual}</div>
                  </li>
                ))}
              </ol>

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
