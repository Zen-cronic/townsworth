import "../landing.css";
import "./sources.css";
import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { ScrollToHash } from "@/components/ui/ScrollToHash";
import { SpyLinks } from "@/components/ui/SpyLinks";
import { PRODUCT_NAME } from "@/components/landing/brand";
import { Chevron } from "@/components/landing/Chevron";
import { commitmentsFor } from "@/lib/commitments";
import { splitFigures } from "@/components/charts";
import { computeProof } from "@/lib/proof";
import { TOWNS } from "@/lib/towns";

export const metadata: Metadata = {
  title: `Sources · ${PRODUCT_NAME}`,
  description: `Every figure on ${PRODUCT_NAME} with its source: material commitments, the evidence and its method, fund figures and the business case.`,
};

// Per request: never freeze a failed Qloo call into the page (see src/lib/qloo.ts).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

const TOPICS = ["Jobs", "Power", "Water", "Noise & light", "Tax"] as const;

// A percentage figure with its bar(s): survey blue for this product, quiet olive for AI alone.
function PctBars({ bars }: { bars: { label: string; pct: number; tone: "gn" | "llm" }[] }) {
  return (
    <span className="src-bars ch-anim" aria-hidden>
      {bars.map((b) => (
        <span key={b.label} className="src-bar">
          <span className="src-bar-who">{b.label}</span>
          <span className="src-bar-t">
            <span className={`ch-hbar ${b.tone === "llm" ? "is-quiet" : ""}`} style={{ width: `${Math.max(b.pct, 1)}%` }} />
          </span>
          <b className={b.tone === "gn" ? "is-ok" : ""}>{b.pct}%</b>
        </span>
      ))}
    </span>
  );
}

export default async function SourcesPage() {
  const { totals: t, baseline, towns } = await computeProof();
  const figures: { k: string; text: string; bars: { label: string; pct: number; tone: "gn" | "llm" }[] }[] = [
    {
      k: "Institutions",
      text: `${t.llmInstitutionalPct}% of the partners AI alone named are institutions, against ${t.gnInstitutionalPct}% of ${PRODUCT_NAME}'s local partners.`,
      bars: [
        { label: "AI alone", pct: t.llmInstitutionalPct, tone: "llm" },
        { label: PRODUCT_NAME, pct: t.gnInstitutionalPct, tone: "gn" },
      ],
    },
    {
      k: "Confirmed",
      text: `${t.llmVerifiedPct}% of the partners AI alone named could be confirmed on Qloo or OpenStreetMap within 25 km. Unverified is not proof of invented.`,
      bars: [{ label: "AI alone", pct: t.llmVerifiedPct, tone: "llm" }],
    },
    { k: "New", text: `${t.gnNovelPct}% of ${PRODUCT_NAME}'s local partners never appear in the AI-alone plans.`, bars: [{ label: PRODUCT_NAME, pct: t.gnNovelPct, tone: "gn" }] },
    {
      k: "Ranking",
      text: `${t.affinityChangedPct}% of picks change when the same candidates are ordered by distance instead of by how much locals favour them (Qloo).`,
      bars: [{ label: PRODUCT_NAME, pct: t.affinityChangedPct, tone: "gn" }],
    },
    {
      k: "Wiring",
      text: `Partners appear in their own town's Qloo places ${t.controlOwnPct}% of the time and another town's ${t.controlCrossPct}%. This holds by construction and is not a finding.`,
      bars: [],
    },
  ];
  const cited = TOWNS.map((town) => ({ town, c: commitmentsFor(town.slug) }));
  const maxCited = Math.max(1, ...cited.map(({ c }) => c?.items.length ?? 0));

  return (
    <div className="gn-landing sp">
      <AppHeader towns={false} />
      <ScrollToHash />
      <main id="main">
        <section className="src-hero sp-hero" aria-labelledby="src-h">
          <div className="lp-wrap sp-hero-grid">
            <div className="sp-hero-copy">
            <p className="lp-kicker">Sources · every figure, with where it came from</p>
            <h1 id="src-h" className="lp-h1">
              Every number, <span className="lp-tone">sourced.</span>
            </h1>
            <p className="lp-lede">
              The commitments are cited public reporting. Fund figures are illustrative unless a public figure exists.
            </p>
            </div>
                <figure className="src-matrix">
                  <table>
                    <caption className="sr-only">Cited figures per town and topic</caption>
                    <thead>
                      <tr>
                        <th scope="col">
                          <span className="sr-only">Town</span>
                        </th>
                        {TOPICS.map((k) => (
                          <th key={k} scope="col">
                            {/* Phones show the short name; the full one stays for screen readers. */}
                            <span className="sp-th-long">{k}</span>
                            <span className="sp-th-short" aria-hidden>
                              {k.split(" ")[0]}
                            </span>
                          </th>
                        ))}
                        <th scope="col" className="src-matrix-total">
                          Cited
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {cited.map(({ town, c }) => {
                        const total = c?.items.length ?? 0;
                        return (
                          <tr key={town.slug}>
                            <th scope="row">
                              <a href={`#src-${town.slug}`}>{town.name}</a>
                            </th>
                            {TOPICS.map((k) => {
                              const n = c?.items.filter((it) => it.topic === k).length ?? 0;
                              return (
                                <td key={k} className={n ? `is-cited is-n${Math.min(n, 3)}` : "is-empty"}>
                                  <span>{n || <span aria-label="none">·</span>}</span>
                                </td>
                              );
                            })}
                            <td className="src-matrix-total">
                              <span className="src-matrix-bar ch-anim" aria-hidden>
                                <span className="ch-hbar" style={{ width: `${(total / maxCited) * 100}%` }} />
                              </span>
                              <b>{total}</b>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <figcaption>Cited figures per town and topic. Open a town for each figure and its source.</figcaption>
                </figure>
          </div>
        </section>

        <div className="src-body">
          <div className="lp-wrap src-layout">
            <nav className="src-toc" aria-labelledby="src-toc-h">
              <p id="src-toc-h" className="text-xs font-semibold text-muted">
                On this page
              </p>
              {SECTIONS.map(([id, label]) => (
                <a key={id} href={`#${id}`}>
                  {label}
                </a>
              ))}
              <SpyLinks current="location" />
            </nav>

            <div>
              <section id="commitments" className="src-section" aria-labelledby="commitments-h">
                <h2 id="commitments-h" className="lp-h2">
                  Material commitments
                </h2>
                <p>Cited public reporting per preset town. Check each figure against the developer&apos;s filings before it goes to a committee.</p>
                {TOWNS.map((town) => {
                  const c = commitmentsFor(town.slug);
                  if (!c) return null;
                  return (
                    <details key={town.slug} id={`src-${town.slug}`} className="src-town scroll-mt-28" open={town.slug === TOWNS[0].slug}>
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
                              {splitFigures(it.text).map((part, j) => (j % 2 ? <b key={j} className="memo-fig">{part}</b> : part))}
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
                      <span>
                        {f.bars.length > 0 && <PctBars bars={f.bars} />}
                        {f.text}
                      </span>
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
                  <li className="is-qloo">
                    <span className="src-k">Qloo</span>
                    <span>
                      Insights API: places within 15 km ranked by how much locals favour them, plus local taste for brands, artists, TV and podcasts. About 25
                      calls per town; aggregate for the town, never about a person.
                    </span>
                  </li>
                  <li className="is-qloo">
                    <span className="src-k">Age groups</span>
                    <span>
                      The age-group check asks Qloo about three groups only: young adults (under 25), older residents and families with young
                      children. Each uses aggregate place affinities; no resident is scored and the check asks about no other group.
                    </span>
                  </li>
                  <li className="is-qloo">
                    <span className="src-k">Partner ages</span>
                    <span>
                      Up to three Insights calls per town (urn:demographics, five partner ids each, up to 15 partners) give each partner&apos;s
                      audience age profile: which age groups over-index among the people who favour the place, relative to the average. Only the
                      age buckets are read; gender is discarded. It is not a visitor count and says nothing about this town&apos;s residents.
                    </span>
                  </li>
                  <li className="is-qloo">
                    <span className="src-k">Place traits</span>
                    <span>
                      One more Insights call per town (urn:tag at the site, place tags only, take 50) gives the genres, ambience and dishes places
                      around the site over-index on. Only tags that describe the place itself are kept: tags about who goes there, age ranges,
                      neighbourhood descriptors and generic ones are dropped. A
                      partner&apos;s &ldquo;Why&rdquo; names the traits it carries, by rank among the rest.
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
                    <span>Background loop: our own line drawing; positions are schematic.</span>
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
