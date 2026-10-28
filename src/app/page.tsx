import "./landing.css";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { preload } from "react-dom";
import { AppHeader } from "@/components/AppHeader";
import { AuditPreview, type PreviewRow } from "@/components/landing/AuditPreview";
import { PRODUCT_NAME } from "@/components/landing/brand";
import { Chapter } from "@/components/landing/Chapter";
import { Chevron } from "@/components/landing/Chevron";
import { Guardrails } from "@/components/landing/Guardrails";
import { HeroBackdrop } from "@/components/landing/HeroBackdrop";
import { heroFacts } from "@/components/landing/heroFacts";
import { HostStack, type StackData } from "@/components/landing/HostStack";
import { LandingEffects } from "@/components/landing/LandingEffects";
import { HERO_VIDEO } from "@/components/landing/media";
import { MotionToggle } from "@/components/landing/MotionToggle";
import { Objections, objectionsFor } from "@/components/landing/Objections";
import { ProofBand, type ProofStat } from "@/components/landing/ProofBand";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SpecBand } from "@/components/landing/SpecBand";
import { specsFor } from "@/components/landing/specs";
import { TownGrid, type TownPick } from "@/components/landing/TownGrid";
import { isKept } from "@/lib/audit";
import { computeProof } from "@/lib/proof";
import { money, runTown } from "@/lib/run";
import { HERO_TOWN, TOWNS } from "@/lib/towns";

const TITLE = `${PRODUCT_NAME}: a community-benefits plan built from the host town`;
const DESCRIPTION = `${PRODUCT_NAME} checks a facility's draft community plan line by line, keeps the real local institutions, swaps generic items for venues and suppliers residents use (ranked by Qloo's local taste data), and costs every item from the fund.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", images: [{ url: "/landing/og.png", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/landing/og.png"] },
};

const FACILITY_LABEL = { "data center": "Data center", fab: "Chip fab", nuclear: "Nuclear plant", plant: "Plant" } as const;

export default async function Home() {
  // Same arguments as computeProof, so every town run is shared within the request.
  const [run, proof, townRuns] = await Promise.all([
    runTown(HERO_TOWN.slug, undefined, "llm"),
    computeProof(),
    Promise.all(TOWNS.map((t) => runTown(t.slug, undefined, "llm"))),
  ]);
  if (!run) notFound();
  const { town, audit, program, qlooAdds } = run;
  const facts = heroFacts(run);
  const auditHref = facts.townHref;
  if (HERO_VIDEO.ready) preload(HERO_VIDEO.poster, { as: "image", fetchPriority: "high" });

  // Preview: the strongest swap alone: a struck line whose replacement is a host-community place, best affinity first.
  const rows: PreviewRow[] = audit.map((r, i) => ({ ...r, n: i + 1 }));
  const kept = rows.filter((r) => isKept(r.verdict));
  const struck = rows.filter((r) => !isKept(r.verdict));
  const swaps = struck
    .filter((r) => r.replacement?.partner)
    .sort(
      (a, b) =>
        Number(!!a.replacement!.partner!.neighbouring) - Number(!!b.replacement!.partner!.neighbouring) ||
        (a.replacement!.partner!.affinityRank ?? 1e6) - (b.replacement!.partner!.affinityRank ?? 1e6),
    );
  const preview = [swaps[0] ?? struck.find((r) => r.replacement)]
    .filter((r): r is PreviewRow => !!r)
    .filter((r, i, all) => all.findIndex((x) => x.n === r.n) === i)
    .sort((a, b) => a.n - b.n);

  const t = proof.totals;
  const heroProofEarly = proof.towns.find((p) => p.slug === HERO_TOWN.slug);
  const paired = {
    measure: "Partners that are institutions",
    note: "Colleges, districts, chambers and city departments. Lower means more of the places residents actually go.",
    llm: t.llmInstitutionalPct,
    gn: t.gnInstitutionalPct,
  };
  const stats: ProofStat[] = [
    { pct: t.gnNovelPct, arm: "gn", label: "of our local partners AI alone never named", note: "Qloo isn’t re-deriving what the model already knows." },
    { pct: t.llmVerifiedPct, arm: "llm", label: "of the partners AI alone named could be confirmed", note: "Checked against Qloo and OpenStreetMap within 25 km." },
    {
      pct: t.affinityChangedPct,
      arm: "gn",
      label: "of picks change without Qloo’s taste ranking",
      note: `Same places ordered by distance instead${heroProofEarly ? `: ${heroProofEarly.gnPicksChangedByAffinity} of ${heroProofEarly.gnPicks} in ${HERO_TOWN.name}` : ""}. Modest, and measured.`,
    },
  ];

  const partnersByTown = Object.fromEntries(proof.towns.map((p) => [p.slug, p.gnPartners]));
  const heroProof = proof.towns.find((p) => p.slug === town.slug);

  // Each town's own top pick and the taste that stands out most, so the cards differ the way the plans do.
  const SIGNAL_TYPE = { brand: "brand", artist: "artist", tv_show: "TV show", podcast: "podcast" } as const;
  const picksByTown: Record<string, TownPick> = {};
  townRuns.forEach((r, i) => {
    if (!r) return;
    const withPartner = r.program.items.filter((it) => it.partner);
    const top = withPartner.find((it) => it.bucket === "procurement") ?? withPartner[0];
    const signal = (["brand", "artist", "tv_show", "podcast"] as const)
      .flatMap((type) => r.profile.taste[type].filter((x) => x.distinct).map((x) => ({ type, x })))
      .sort((a, b) => a.x.rank - b.x.rank)[0];
    picksByTown[TOWNS[i].slug] = {
      pick: top?.partner ? { kind: top.title.split(/: | at /)[0], partner: top.partner.name, km: top.partner.distanceKm } : undefined,
      signal: signal ? { name: signal.x.entity.name, type: SIGNAL_TYPE[signal.type] } : undefined,
    };
  });
  const townLabel = `${town.name}, ${town.region}`;

  // The stack: cited commitments, the partner places by local affinity, and the costed items they feed.
  const specs = specsFor(town.slug);
  const short = (name: string) => name.split(/ & | - |, | \| /)[0];
  const partnerItems = program.items.filter((it) => it.partner);
  const seen = new Set<string>();
  const places = [...partnerItems]
    .sort((a, b) => (a.partner!.affinityRank ?? 1e6) - (b.partner!.affinityRank ?? 1e6))
    .filter((it) => !seen.has(it.partner!.name) && !!seen.add(it.partner!.name))
    .slice(0, 4)
    .map((it) => ({ name: short(it.partner!.name), rank: it.partner!.affinityRank }));
  const stack: StackData = {
    town: town.name,
    commitments: (specs?.specs ?? []).map((s) => ({ topic: s.topic, value: `${s.value} ${s.unit}`, note: s.note })),
    places,
    // One item per program area, so the board shows the range of the program.
    items: partnerItems
      .filter((it, i, all) => all.findIndex((x) => x.bucket === it.bucket) === i)
      .slice(0, 3)
      .map((it) => ({ kind: it.title.split(/: | at |, /)[0], partner: short(it.partner!.name), amount: money(it.amount) })),
    memoHref: facts.memoHref,
    ballotHref: facts.ballotHref,
    auditHref,
  };

  const objections = objectionsFor(
    facts,
    {
      novelPct: t.gnNovelPct,
      changedPct: t.affinityChangedPct,
      changedLine: heroProof ? `${heroProof.gnPicksChangedByAffinity} of ${heroProof.gnPicks} in ${town.name}` : undefined,
    },
    town.sponsor,
  );
  const film = HERO_VIDEO.ready;

  return (
    <div className="gn-landing">
      <AppHeader towns={false} />
      <LandingEffects />

      <main>
        <section className={`lp-hero lp-grain ${film ? "has-film" : ""}`} aria-labelledby="hero-h">
          {film && <HeroBackdrop media={HERO_VIDEO} />}
          <div className="lp-wrap lp-hero-grid">
            <div className="lp-hero-copy">
              <p className="lp-kicker lp-for">For community-affairs teams at data centers, fabs and plants</p>
              <h1 id="hero-h" className="lp-h1">
                A community-benefits plan built from the host town, <span className="lp-tone">not a template.</span>
              </h1>
              <p className="lp-lede">
                {PRODUCT_NAME} checks a data center’s or plant’s draft plan line by line. It keeps the real local institutions,
                swaps generic items for venues and suppliers residents actually use (ranked by Qloo’s local taste data), and
                costs every item from your fund.
              </p>
              <div className="lp-ctas">
                <Link href={auditHref} className="lp-btn lp-btn-primary">
                  Open the {town.name} audit
                  <span className="lp-btn-sq" aria-hidden="true">
                    <Chevron />
                  </span>
                </Link>
                <Link href="/judges" className="lp-btn lp-btn-quiet">
                  Guided path <span className="lp-btn-meta">2 min</span>
                </Link>
              </div>
            </div>

            <AuditPreview
              rows={preview}
              townLabel={townLabel}
              facility={FACILITY_LABEL[town.facility]}
              href={auditHref}
              kept={kept.length}
              struck={struck.length}
              total={rows.length}
              added={qlooAdds.length}
              verdicts={audit.map((r) => r.verdict)}
            />
          </div>
          <MotionToggle className="lp-motion-corner" />
        </section>

        {specs && (
          <Chapter n="01" name="Commitments first" id="ch-01" labelledBy="ch-01-h">
            <div className="lp-section-head">
              <h2 id="ch-01-h" className="lp-h2">
                Jobs, water, power and tax come first. The program sits on top.
              </h2>
              <p className="lp-section-lede">
                In {town.name}, {town.sponsor}’s material commitments open the committee memo, each from cited public reporting.{" "}
                {PRODUCT_NAME} never trades them for programs.
              </p>
            </div>
            <SpecBand specs={specs.specs} town={town.name} asOf={specs.asOf} />
          </Chapter>
        )}

        <Chapter n="02" name="How it works" id="ch-02" labelledBy="ch-02-h">
          <div className="lp-section-head">
            <h2 id="ch-02-h" className="lp-h2">
              Generic plan in. <span className="lp-tone">A costed, local program out.</span>
            </h2>
            <p className="lp-section-lede">
              Three layers, from the ground up: the facility and its draft, the town and the places locals favour, and the program
              built from them. Drawn from the {town.name} run.
            </p>
          </div>
          <HostStack data={stack} nextId="ch-03" />
        </Chapter>

        <Chapter n="03" name="The evidence" id="ch-03" labelledBy="proof-h" tone="is-ink">
          <ProofBand paired={paired} stats={stats} townCount={TOWNS.length === 6 ? "six" : String(TOWNS.length)} />
        </Chapter>

        <Chapter n="04" name="Any host town" id="ch-04" labelledBy="towns-h">
          <TownGrid towns={TOWNS} partners={partnersByTown} picks={picksByTown} heroSlug={HERO_TOWN.slug} />
        </Chapter>

        <Chapter n="05" name="Questions" id="ch-05" labelledBy="ch-05-h">
          <div className="lp-section-head">
            <h2 id="ch-05-h" className="lp-h2">
              Fair questions, answered by the product itself.
            </h2>
            <p className="lp-section-lede">Open any of them: the answer is the live screen, not a claim on this page.</p>
          </div>
          <Objections items={objections} />
          <Guardrails />
        </Chapter>

        <section
          className={`lp-close ${film ? "has-film" : "lp-grain"}`}
          aria-labelledby="close-h"
          style={film ? ({ "--poster": `url(${HERO_VIDEO.poster})`, "--poster-p": `url(${HERO_VIDEO.portraitPoster})` } as React.CSSProperties) : undefined}
        >
          <div className="lp-wrap lp-close-inner">
            <h2 id="close-h" className="lp-h2">
              See a real plan, <span className="lp-tone">checked line by line.</span>
            </h2>
            <div className="lp-ctas">
              <Link href={auditHref} className="lp-btn lp-btn-primary">
                Open the {town.name} audit
                <span className="lp-btn-sq" aria-hidden="true">
                  <Chevron />
                </span>
              </Link>
              <Link href={`/memo/${town.slug}`} className="lp-btn lp-btn-quiet">
                Read the committee memo
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
