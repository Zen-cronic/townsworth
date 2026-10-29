import "../landing.css";
import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { PRODUCT_NAME } from "@/components/landing/brand";
import { Chevron } from "@/components/landing/Chevron";
import { commitmentsFor } from "@/lib/commitments";
import { computeProof } from "@/lib/proof";
import { TOWNS } from "@/lib/towns";

export const metadata: Metadata = {
  title: `Sources · ${PRODUCT_NAME}`,
  description: `Every figure on ${PRODUCT_NAME} with its source: material commitments, the evidence and its method, fund figures and the business case.`,
};

// Figures from the business case, each with the public source it was read from.
const MARKET: { k: string; text: string; source: string; url: string }[] = [
  {
    k: "Buyer",
    text: "Micron and partners committed a $500M Green CHIPS Community Investment Fund over 20 years for Clay, New York.",
    source: "Empire State Development",
    url: "https://esd.ny.gov/green-chips-community-investment-fund",
  },
  {
    k: "Buyer",
    text: "Frederick County, Maryland secured a $110M+ community benefits agreement for a data-center campus.",
    source: "MACo Conduit Street, Sep 2026",
    url: "https://conduitstreet.mdcounties.org/2026/09/02/frederick-secures-110m-community-benefits-agreement-for-data-center-campus/",
  },
  {
    k: "Buyer",
    text: "Swatara Township, Pennsylvania approved a $120.3M community benefits package for two proposed data centers.",
    source: "Blackridge Research, Oct 2026",
    url: "https://www.blackridgeresearch.com/news-releases/swatara-township-approves-usd-120-3-million-community-benefits-package-for-two-proposed-data-centers",
  },
  {
    k: "Volume",
    text: "539 US data-center buildings are under construction and 2,386 more are planned.",
    source: "Cleanview, Oct 27 2026",
    url: "https://cleanview.co/public/data-centers/us",
  },
  {
    k: "Volume",
    text: "About $425B of US data-center construction is active.",
    source: "Industrial Info Resources, Oct 2026",
    url: "https://www.industrialinfo.com/news/article/us-data-center-construction-starts-still-soaring-despite-some-bumps-in-the-road--363883",
  },
  {
    k: "Context",
    text: "About $130B of data-center projects were counted as blocked or delayed by local opposition in Q1 2026.",
    source: "Data Center Watch",
    url: "https://datacenterwatch.org/q1-2026",
  },
  {
    k: "Pricing",
    text: "Pricing hypothesis, not validated: a per-project annual licence, set against civic-engagement software that publishes £13,200–£35,200 a year. We have not yet talked to a paying buyer.",
    source: "EngagementHQ pricing, G-Cloud 15",
    url: "https://assets.applytosupply.digitalmarketplace.service.gov.uk/g-cloud-15/documents/92418/394920096965516-pricing-document-2026-01-29-1924.pdf",
  },
];

const SECTIONS = [
  ["commitments", "Material commitments"],
  ["evidence", "The evidence"],
  ["funds", "Fund figures"],
  ["market", "Business case"],
  ["data", "Data and media"],
] as const;

export default async function SourcesPage() {
  const { totals: t, baseline, towns } = await computeProof();
  const figures: { k: string; text: string }[] = [
    { k: "Institutions", text: `${t.llmInstitutionalPct}% of the partners AI alone named are institutions, against ${t.gnInstitutionalPct}% of ${PRODUCT_NAME}'s local partners.` },
    { k: "Confirmed", text: `${t.llmVerifiedPct}% of the partners AI alone named could be confirmed on Qloo or OpenStreetMap within 25 km. Unverified is not proof of invented.` },
    { k: "New", text: `${t.gnNovelPct}% of ${PRODUCT_NAME}'s local partners never appear in the AI-alone plans.` },
    { k: "Ranking", text: `${t.affinityChangedPct}% of picks change when the same candidates are ordered by distance instead of Qloo's local affinity.` },
    { k: "Wiring", text: `Partners appear in their own town's Qloo places ${t.controlOwnPct}% of the time and another town's ${t.controlCrossPct}%. This holds by construction and is not a finding.` },
  ];

  return (
    <div className="gn-landing">
      <AppHeader />
      <main>
        <section className="src-hero lp-grain" aria-labelledby="src-h">
          <div className="lp-wrap">
            <p className="lp-kicker">Sources · every figure, with where it came from</p>
            <h1 id="src-h" className="lp-h1">
              Every number, <span className="lp-tone">sourced.</span>
            </h1>
            <p className="lp-lede">
              The commitments are cited public reporting. The evidence is recomputed from frozen plans on every load. Fund figures
              are illustrative unless a public figure exists.
            </p>
          </div>
        </section>

        <div className="src-body">
          <div className="lp-wrap src-layout">
            <nav className="src-toc" aria-label="On this page">
              {SECTIONS.map(([id, label]) => (
                <a key={id} href={`#${id}`}>
                  {label}
                </a>
              ))}
            </nav>

            <div>
              <section id="commitments" className="src-section" aria-labelledby="commitments-h">
                <h2 id="commitments-h" className="lp-h2">
                  Material commitments
                </h2>
                <p>
                  Jobs, power, water, noise and tax, per preset town, as reported. Each memo opens with these; check every figure against the
                  developer&apos;s filings before it goes to a committee.
                </p>
                {TOWNS.map((town) => {
                  const c = commitmentsFor(town.slug);
                  if (!c) return null;
                  return (
                    <details key={town.slug} className="src-town" open={town.slug === TOWNS[0].slug}>
                      <summary>
                        <span className="lp-h3">
                          {town.name}, {town.region}
                        </span>
                        <span className="src-count">
                          {c.items.length} cited {c.items.length === 1 ? "figure" : "figures"} · as of {c.asOf}
                        </span>
                        <Chevron className="lp-chev src-chev" />
                      </summary>
                      <ul className="src-list">
                        {c.items.map((it, i) => (
                          <li key={i}>
                            <span className="src-k">{it.topic}</span>
                            <span>
                              {it.text}
                              <br />
                              <a href={it.url} target="_blank" rel="noopener noreferrer">
                                {it.source}
                              </a>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  );
                })}
              </section>

              <section id="evidence" className="src-section" aria-labelledby="evidence-h">
                <h2 id="evidence-h" className="lp-h2">
                  The evidence
                </h2>
                <p>
                  For each of {towns.length} host towns, OpenAI {baseline.model}, with no Qloo data, wrote the plan a consultant would. The
                  plans were frozen on {baseline.createdAt.slice(0, 10)} before any measurement. The method, the per-town table and what the
                  test does not prove are on <Link href="/proof" className="lp-textlink">the evidence page</Link>.
                </p>
                <ul className="src-list">
                  {figures.map((f) => (
                    <li key={f.k}>
                      <span className="src-k">{f.k}</span>
                      <span>{f.text}</span>
                    </li>
                  ))}
                  <li>
                    <span className="src-k">Prompt</span>
                    <span className="src-mono">{baseline.promptVersion}</span>
                  </li>
                  <li>
                    <span className="src-k">SHA-256</span>
                    <span className="src-mono">{baseline.sha256}</span>
                  </li>
                </ul>
              </section>

              <section id="funds" className="src-section" aria-labelledby="funds-h">
                <h2 id="funds-h" className="lp-h2">
                  Fund figures
                </h2>
                <p>
                  Amounts are sessions × a unit cost for instructors, stipends, childcare and venue hire, drawn from the fund. None of them
                  come from Qloo. Whatever isn&apos;t itemized is held in reserve for the committee.
                </p>
                <ul className="src-list">
                  {TOWNS.map((town) => (
                    <li key={town.slug}>
                      <span className="src-k">{town.name}</span>
                      <span>{town.fundNote}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section id="market" className="src-section" aria-labelledby="market-h">
                <h2 id="market-h" className="lp-h2">
                  Business case
                </h2>
                <p>Who already runs these funds, how many projects are coming, and how we might price it.</p>
                <ul className="src-list">
                  {MARKET.map((m) => (
                    <li key={m.url}>
                      <span className="src-k">{m.k}</span>
                      <span>
                        {m.text}
                        <br />
                        <a href={m.url} target="_blank" rel="noopener noreferrer">
                          {m.source}
                        </a>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section id="data" className="src-section" aria-labelledby="data-h">
                <h2 id="data-h" className="lp-h2">
                  Data and media
                </h2>
                <ul className="src-list">
                  <li>
                    <span className="src-k">Qloo</span>
                    <span>
                      Insights API: places within 15 km ranked by local affinity, plus local taste for brands, artists, TV and podcasts. About 25
                      calls per town; aggregate for the town, never about a person.
                    </span>
                  </li>
                  <li>
                    <span className="src-k">OpenStreetMap</span>
                    <span>
                      Partner checks and town geocoding (Nominatim). Map data © OpenStreetMap contributors, available under the Open Database
                      Licence.{" "}
                      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
                        openstreetmap.org/copyright
                      </a>
                    </span>
                  </li>
                  <li>
                    <span className="src-k">OpenAI</span>
                    <span>The AI-alone drafts, the live drafts for typed-in towns, and the outreach agent. Every outreach draft is rule-checked.</span>
                  </li>
                  <li>
                    <span className="src-k">Ballot</span>
                    <span>The committee tally is simulated: seeded random sample ballots that show how the ranking works and predict nothing.</span>
                  </li>
                  <li>
                    <span className="src-k">Media</span>
                    <span>Background loop: our own line drawing, rendered in Remotion; positions are schematic.</span>
                  </li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
