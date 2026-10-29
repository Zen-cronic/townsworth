import "../landing.css";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { PRODUCT_NAME } from "@/components/landing/brand";
import { Chevron } from "@/components/landing/Chevron";
import { heroFacts } from "@/components/landing/heroFacts";
import { Objections, objectionsFor } from "@/components/landing/Objections";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SIMULATED_BALLOTS } from "@/lib/ballot";
import { computeProof } from "@/lib/proof";
import { runTown } from "@/lib/run";
import { HERO_TOWN } from "@/lib/towns";

export const metadata: Metadata = {
  title: `Guided path · ${PRODUCT_NAME}`,
  description: `See ${PRODUCT_NAME} work in two minutes: a finished example, the committee memo, the resident ballot, any host town, and the evidence with its limits.`,
};

interface Step {
  title: string;
  body: string;
  notice: string;
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

  const steps: Step[] = [
    {
      title: "The draft, checked line by line",
      body: `${town} is the example: a ${HERO_TOWN.sponsor} data center campus. Its draft community plan was written by AI alone, the way a consultant would, and every line is kept or struck.`,
      notice: f.swap
        ? `Line ${f.swap.line} is struck: it could fit any town. In its place: ${f.swap.title}${f.swap.rank ? `, #${f.swap.rank} by local affinity` : ""}. Click “Why” to see the Qloo signal.${f.institution ? ` Line ${f.institution.line} keeps ${f.institution.name}: real institutions stay.` : ""}`
        : "Struck lines could fit any town; each replacement names a local place and the Qloo signal behind it.",
      primary: { href: f.swap?.href ?? f.townHref, label: f.swap ? `Open line ${f.swap.line}` : "Open the check" },
      secondary: f.institution ? { href: f.institution.href, label: "See a kept institution" } : undefined,
    },
    {
      title: "The committee memo",
      body: "The document a community-affairs lead takes to the community committee, with a partner sheet (CSV) and a 24-month calendar (.ics).",
      notice: `Commitments come first, in section 1. Every item is costed per session from the fund; the rest is held in reserve for the committee. Click Draft outreach: an OpenAI agent picks partners, confirms each on OpenStreetMap and drafts emails that name the funder (${HERO_TOWN.sponsor}).`,
      primary: { href: f.memoHref, label: "Open the memo" },
      secondary: { href: `${f.memoHref}#commitments`, label: "See section 1" },
    },
    {
      title: "Residents rank",
      body: "From the memo, the shortlist goes to residents: they put the grants and events in order on an anonymous ballot.",
      notice: `The funder is named before anything is ranked. The committee tally adds ${SIMULATED_BALLOTS} simulated ballots to yours, and every screen says so.`,
      primary: { href: f.ballotHref, label: "Open the ballot" },
      secondary: { href: `${f.resultsHref}#simulated`, label: "See the tally" },
    },
    {
      title: "Any host town",
      body: "Type any US or Canadian town with the company that funds it. The picks change because the town changes.",
      notice: "Taylor, Texas (a Samsung chip fab) starts from the consultant template; click “Have AI write a draft now” to watch OpenAI write one live, in about 20 seconds. Kemmerer, Wyoming shows the plan with limited local data.",
      primary: { href: "/find?q=Taylor%2C%20TX&facility=fab&company=Samsung", label: "Try Taylor, TX" },
      secondary: { href: "/town/kemmerer-wy", label: "Open Kemmerer" },
    },
    {
      title: "The evidence and its limits",
      body: `AI alone against ${PRODUCT_NAME} in six host towns, with frozen plans, a wiring check, and a list of what the test does not prove.`,
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
      <SiteFooter />
    </div>
  );
}
