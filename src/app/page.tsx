import "./landing.css";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { preload } from "react-dom";
import { AppHeader } from "@/components/AppHeader";
import { AuditPreview, type PreviewRow } from "@/components/landing/AuditPreview";
import { LiveDataNotice } from "@/components/LiveDataNotice";
import { PilotLink } from "@/components/PilotLink";
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
import { type Objection, Objections } from "@/components/landing/Objections";
import { ProofBand, type ProofStat } from "@/components/landing/ProofBand";
import { SpecBand } from "@/components/landing/SpecBand";
import { specsFor } from "@/components/landing/specs";
import { TownGrid, type TownPick } from "@/components/landing/TownGrid";
import { kindOf } from "@/components/ui/labels";
import { isKept } from "@/lib/audit";
import { computeProof } from "@/lib/proof";
import { money, runTown } from "@/lib/run";
import { HERO_TOWN, TOWNS } from "@/lib/towns";

const TITLE = `${PRODUCT_NAME}: a community-benefits plan built from the host town`;
const DESCRIPTION = `${PRODUCT_NAME} checks a facility's draft community plan line by line, keeps the real local institutions, keeps the institutions it already names, adds the local places residents go that AI alone never names (Qloo's local taste data), and costs each item.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", images: [{ url: "/landing/og.png", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/landing/og.png"] },
};

// Per request: never freeze a failed Qloo call into the page (see src/lib/qloo.ts).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  // The hero run's Qloo calls failed on this request: the card and the stack say so instead of "+0".
  const heroFailed = run.profile.failedCalls.length ? [town.name] : [];
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
  // With nothing struck, the card shows a kept institution and the local partner added alongside it.
  const preview: PreviewRow | undefined = swaps[0] ?? struck.find((r) => r.replacement) ?? kept.find((r) => r.alongside?.partner) ?? kept[0];

  const t = proof.totals;
  const heroProofEarly = proof.towns.find((p) => p.slug === HERO_TOWN.slug);
  const paired = {
    measure: "Partners that are institutions",
    note: "Lower means more of the places residents actually go.",
    llm: t.llmInstitutionalPct,
    gn: t.gnInstitutionalPct,
  };
  const stats: ProofStat[] = [
    { pct: t.gnNovelPct, arm: "gn", label: "of our local partners AI alone never named", note: "Qloo adds what the model doesn’t know." },
    { pct: t.llmVerifiedPct, arm: "llm", label: "of the partners AI alone named could be confirmed", note: "On Qloo or OpenStreetMap, within 25 km." },
    {
      pct: t.affinityChangedPct,
      arm: "gn",
      label: "of picks change without Qloo’s taste ranking",
      note: `Ordered by distance instead${heroProofEarly ? `: ${heroProofEarly.gnPicksChangedByAffinity} of ${heroProofEarly.gnPicks} in ${HERO_TOWN.name}` : ""}. Modest, and measured.`,
    },
  ];

  const partnersByTown = Object.fromEntries(proof.towns.map((p) => [p.slug, p.gnPartners]));

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
      pick: top?.partner ? { kind: kindOf(top.title), partner: top.partner.name, km: top.partner.distanceKm } : undefined,
      signal: signal ? { name: signal.x.entity.name, type: SIGNAL_TYPE[signal.type] } : undefined,
    };
  });
  const REGION_SHORT: Record<string, string> = { Wisconsin: "WI", "New York": "NY", Ohio: "OH", Texas: "TX", Ontario: "ON", Wyoming: "WY" };
  const heroLabel = `${town.name}, ${REGION_SHORT[town.region] ?? town.region} · ${FACILITY_LABEL[town.facility].toLowerCase()}`;

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
      .map((it) => ({ kind: kindOf(it.title), partner: short(it.partner!.name), amount: money(it.amount) })),
    memoHref: facts.memoHref,
    ballotHref: facts.ballotHref,
    auditHref,
  };

  // Four questions on the landing, one line each; the guided path carries the full list.
  const objections: Objection[] = [
    { q: "Couldn’t ChatGPT do this?", a: `It names the institutions; ${t.gnNovelPct}% of our local partners it never names.`, href: "/proof#finding-3" },
    { q: "Isn’t this a nearby-places list?", a: `Ordering by distance changes ${t.affinityChangedPct}% of picks: modest, and measured.`, href: "/proof#finding-4" },
    { q: "Does it replace jobs, water or tax commitments?", a: "No. They open the memo; the program sits on top.", href: `${facts.memoHref}#commitments` },
    { q: "Are the votes and dollars real?", a: "The tally is simulated and predicts nothing; funds are illustrative.", href: `${facts.resultsHref}#simulated` },
  ];
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
                {PRODUCT_NAME} checks a data center’s or plant’s{" "}
                <abbr title="The community-benefits plan, or CBA, that a facility funds" className="lp-abbr">
                  community-benefits plan
                </abbr>{" "}
                line by line. It keeps the institutions, adds the places residents actually go, and costs each item.
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

            <AuditPreview row={preview} townLabel={heroLabel} href={auditHref} kept={kept.length} struck={struck.length} added={qlooAdds.length} failed={heroFailed} />
          </div>
          <MotionToggle className="lp-motion-corner" />
        </section>

        {specs && (
          <Chapter name="Commitments" id="ch-01" labelledBy="ch-01-h">
            <div className="lp-section-head">
              <h2 id="ch-01-h" className="lp-h2">
                Jobs, water, power and tax come first. The program sits on top.
              </h2>
              <p className="lp-section-lede">
                {town.sponsor}’s commitments in {town.name} open the memo, each with its source.
              </p>
            </div>
            <SpecBand specs={specs.specs} town={town.name} asOf={specs.asOf} />
          </Chapter>
        )}

        <Chapter name="How it works" id="ch-02" labelledBy="ch-02-h">
          <div className="lp-section-head">
            <h2 id="ch-02-h" className="lp-h2">
              Generic plan in. <span className="lp-tone">A costed, local program out.</span>
            </h2>
            <p className="lp-section-lede">Three layers, drawn from the {town.name} run.</p>
            <LiveDataNotice towns={heroFailed} subject="these layers" />
          </div>
          <HostStack data={stack} nextId="ch-03" />
        </Chapter>

        <Chapter name="Evidence" id="ch-03" labelledBy="proof-h" tone="is-ink">
          <ProofBand paired={paired} stats={stats} townCount={TOWNS.length === 6 ? "six" : String(TOWNS.length)} failedTowns={proof.failedTowns} />
        </Chapter>

        <Chapter name="Host towns" id="ch-04" labelledBy="towns-h">
          <TownGrid towns={TOWNS} partners={partnersByTown} picks={picksByTown} heroSlug={HERO_TOWN.slug} failedTowns={proof.failedTowns} />
        </Chapter>

        <Chapter name="Questions" id="ch-05" labelledBy="ch-05-h">
          <div className="lp-section-head">
            <h2 id="ch-05-h" className="lp-h2">
              Fair questions.
            </h2>
            <p className="lp-section-lede">Each answer opens the live screen.</p>
            <LiveDataNotice towns={proof.failedTowns} subject="these answers" />
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
              <PilotLink className="lp-btn lp-btn-quiet" />
            </div>
          </div>
        </section>
      </main>

    </div>
  );
}
