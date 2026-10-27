import "./landing.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { AuditPreview, type PreviewRow } from "@/components/landing/AuditPreview";
import { Chevron } from "@/components/landing/Chevron";
import { Guardrails } from "@/components/landing/Guardrails";
import { HowItWorks, type SitePoint } from "@/components/landing/HowItWorks";
import { ProofBand, type ProofFigure } from "@/components/landing/ProofBand";
import { TownGrid, type TownPick } from "@/components/landing/TownGrid";
import { cleanName } from "@/lib/plan";
import { computeProof } from "@/lib/proof";
import { runTown } from "@/lib/run";
import { HERO_TOWN, TOWNS } from "@/lib/towns";

const FACILITY_LABEL = { "data center": "Data center", fab: "Chip fab", nuclear: "Nuclear plant", plant: "Plant" } as const;

export default async function Home() {
  // Same arguments as computeProof, so every town run is shared within the request.
  const [run, proof, townRuns] = await Promise.all([
    runTown(HERO_TOWN.slug, undefined, "llm"),
    computeProof(),
    Promise.all(TOWNS.map((t) => runTown(t.slug, undefined, "llm"))),
  ]);
  if (!run) notFound();
  const { town, audit, program, profile, qlooAdds } = run;
  const auditHref = `/town/${town.slug}`;

  // Preview: the first kept item, then the first two struck items that have a like-for-like replacement.
  const rows: PreviewRow[] = audit.map((r, i) => ({ ...r, n: i + 1 }));
  const kept = rows.filter((r) => r.verdict === "grounded");
  const struck = rows.filter((r) => r.verdict !== "grounded");
  const preview = [kept[0], ...struck.filter((r) => r.replacement).slice(0, 2)]
    .filter((r): r is PreviewRow => !!r)
    .sort((a, b) => a.n - b.n);

  // Site plan: every kept Qloo place within 15 km, at its real offset from the town centre.
  const partnerNames = new Set(program.items.map((it) => it.partner?.name).filter(Boolean));
  const kmPerLon = 111.32 * Math.cos((town.lat * Math.PI) / 180);
  const labelled: [number, number][] = [];
  const points: SitePoint[] = profile.places
    .filter((p) => p.location)
    .map((p) => {
      const name = cleanName(p.name);
      return {
        east: (p.location!.lon - town.lon) * kmPerLon,
        north: (p.location!.lat - town.lat) * 110.57,
        partner: partnerNames.has(name),
        name,
      };
    })
    .filter((p) => Math.hypot(p.east, p.north) <= 15)
    .sort((a, b) => Math.hypot(a.east, a.north) - Math.hypot(b.east, b.north))
    .map(({ name, ...p }) => {
      // Label up to three partners that sit well apart, so names never collide.
      const label =
        p.partner &&
        labelled.length < 4 &&
        Math.hypot(p.east, p.north) > 3 &&
        labelled.every(([e, n]) => Math.hypot(e - p.east, n - p.north) > 4);
      if (label) labelled.push([p.east, p.north]);
      return { ...p, label: label ? name.split(/ & | - |, /)[0].replace(/ (Restaurant|Pancake House)$/, "") : undefined };
    });

  const t = proof.totals;
  const figures: ProofFigure[] = [
    {
      value: `${t.llmVerifiedPct}%`,
      side: "llm",
      label: "of the partners the plain LLM named turned out to be real",
      bars: [{ label: "Verified real", pct: t.llmVerifiedPct, side: "llm" }],
      caveat: "Checked against Qloo or OpenStreetMap within 25 km. Unverified is not proof of invented.",
    },
    {
      value: `${t.gnInstitutionalPct}%`,
      side: "gn",
      label: `of Good Neighbor’s partners are institutions, against ${t.llmInstitutionalPct}% of the LLM’s`,
      bars: [
        { label: "Plain LLM", pct: t.llmInstitutionalPct, side: "llm" },
        { label: "Good Neighbor", pct: t.gnInstitutionalPct, side: "gn" },
      ],
      caveat: "Colleges and chambers are good partners too. Qloo adds the places residents go.",
    },
    {
      value: `${t.gnNovelPct}%`,
      side: "gn",
      label: "of Good Neighbor’s partners the plain LLM never named",
      bars: [{ label: "Never named", pct: t.gnNovelPct, side: "gn" }],
      caveat: "A layer the model doesn’t have. A partner’s willingness is not confirmed.",
    },
    {
      value: `${t.controlOwnPct}%`,
      side: "gn",
      label: `of Good Neighbor’s partners are found in their own town, against ${t.controlCrossPct}% in a wrong one`,
      bars: [
        { label: "Right town", pct: t.controlOwnPct, side: "gn" },
        { label: "Wrong town", pct: t.controlCrossPct, side: "gn" },
      ],
      caveat: "A negative control: the plan is local to its town. It does not show residents prefer it.",
    },
  ];
  const partnersByTown = Object.fromEntries(proof.towns.map((p) => [p.slug, p.gnPartners]));

  // Each town's own top pick and its strongest distinct signal, so the cards differ the way the plans do.
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
      pick: top ? { title: top.title, km: top.partner?.distanceKm } : undefined,
      signal: signal ? { name: signal.x.entity.name, type: SIGNAL_TYPE[signal.type] } : undefined,
    };
  });
  const townLabel = `${town.name}, ${town.region}`;

  return (
    <div className="gn-landing">
      <AppHeader />

      <main>
        <section className="lp-hero" aria-labelledby="hero-h">
          <div className="lp-wrap lp-hero-grid">
            <div className="lp-hero-copy">
              <p className="lp-kicker lp-for">For community-affairs teams at data centers, fabs and nuclear plants</p>
              <h1 id="hero-h" className="lp-h1">
                Red-pen the generic community plan.
              </h1>
              <p className="lp-lede">
                When a data center, fab or nuclear plant comes to town, its community fund usually buys a generic plan.
                Good Neighbor red-pens that plan against what the town actually over-indexes on, and hands back a
                costed program of local partners, each traceable to a Qloo signal.
              </p>
              <div className="lp-ctas">
                <Link href={auditHref} className="lp-btn lp-btn-primary">
                  Open the {town.name} audit <Chevron />
                </Link>
                <Link href="/proof" className="lp-btn lp-btn-quiet">
                  See the proof
                </Link>
              </div>
              <p className="lp-guide">
                New here?{" "}
                <Link href="/judges" className="lp-textlink">
                  Start with the 90-second tour <Chevron />
                </Link>
              </p>
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
        </section>

        <ProofBand figures={figures} townCount={TOWNS.length === 6 ? "six" : String(TOWNS.length)} />
        <HowItWorks points={points} town={townLabel} draft={audit.map((r) => ({ text: r.text, kept: r.verdict === "grounded" }))} />
        <TownGrid towns={TOWNS} partners={partnersByTown} picks={picksByTown} heroSlug={HERO_TOWN.slug} />
        <Guardrails />

        <section className="lp-close" aria-labelledby="close-h">
          <div className="lp-wrap lp-close-inner">
            <h2 id="close-h" className="lp-h2">
              See the red pen on a real plan.
            </h2>
            <div className="lp-ctas">
              <Link href={auditHref} className="lp-btn lp-btn-primary">
                Open the {town.name} audit <Chevron />
              </Link>
              <Link href={`/memo/${town.slug}`} className="lp-btn lp-btn-quiet">
                Read the commitments memo
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-inner">
          <span className="lp-brand">
            <span aria-hidden="true" className="lp-brand-mark" /> Good Neighbor
          </span>
          <span>Qloo signals are aggregate for a town. Costs come from your fund, not from Qloo.</span>
          <nav aria-label="Footer" className="lp-footer-nav">
            <Link href="/proof">Proof</Link>
            <Link href="/judges">Start here</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
