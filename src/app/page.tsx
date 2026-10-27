import "./landing.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { AuditPreview, type PreviewRow } from "@/components/landing/AuditPreview";
import { Chevron } from "@/components/landing/Chevron";
import { Guardrails } from "@/components/landing/Guardrails";
import { HowItWorks, type OutputFragments, type SitePoint } from "@/components/landing/HowItWorks";
import { ProofBand, type ProofRow } from "@/components/landing/ProofBand";
import { TownGrid, type TownPick } from "@/components/landing/TownGrid";
import { cleanName } from "@/lib/plan";
import { computeProof } from "@/lib/proof";
import { money, runTown } from "@/lib/run";
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
  const proofRows: ProofRow[] = [
    {
      measure: "Institutions among named partners",
      note: "Colleges, districts, chambers and city departments. Lower means more of the places residents actually go.",
      llm: { pct: t.llmInstitutionalPct },
      gn: { pct: t.gnInstitutionalPct },
    },
    {
      measure: "Named partners verified as real",
      note: "Checked against Qloo and OpenStreetMap within 25 km.",
      llm: { pct: t.llmVerifiedPct },
      gn: { na: "n/a: picked from Qloo by construction" },
    },
    {
      measure: "Partners the plain LLM never named",
      note: "Qloo isn’t re-deriving what the model already knows.",
      llm: { na: "n/a: measured against the LLM’s own list" },
      gn: { pct: t.gnNovelPct },
    },
    {
      measure: "Control: own town vs swapped town",
      note: `Good Neighbor’s partners appear in their own town’s Qloo places ${t.controlOwnPct}% of the time, and ${t.controlCrossPct}% in a swapped town’s.`,
      llm: { na: "n/a: the LLM has no Qloo list" },
      gn: { pct: t.controlOwnPct },
    },
  ];
  // Real fragments of each output for the example town, matching the memo and the exports.
  const first = program.items.filter((it) => it.partner).find((it) => it.bucket === "procurement") ?? program.items[0];
  const earliest = program.items.filter((it) => it.partner).flatMap((it) => it.months.map((m) => ({ m, it }))).sort((a, b) => a.m - b.m)[0];
  const now = new Date();
  const calDate = earliest
    ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + earliest.m, 15)).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : "";
  const shortName = (name: string) => name.split(/ & | - |, /)[0].split(" ").slice(0, 2).join(" ");
  const kindOf = (title: string) => title.split(/: | at /)[0];
  const outputs: OutputFragments = {
    memo: `Commitments first, then ${program.items.length} programs`,
    sheet: first?.partner ? `${money(first.amount)} · ${kindOf(first.title)} · ${shortName(first.partner.name)}` : "",
    calendar: earliest ? `${calDate} · ${kindOf(earliest.it.title)}` : "",
    drafts: first?.partner ? `To ${shortName(first.partner.name)}, about the ${kindOf(first.title).toLowerCase()}` : "",
  };

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
      pick: top?.partner ? { kind: top.title.split(/: | at /)[0], partner: top.partner.name, km: top.partner.distanceKm } : undefined,
      signal: signal ? { name: signal.x.entity.name, type: SIGNAL_TYPE[signal.type] } : undefined,
    };
  });
  const townLabel = `${town.name}, ${town.region}`;

  return (
    <div className="gn-landing">
      <AppHeader towns={false} />

      <main>
        <section className="lp-hero" aria-labelledby="hero-h">
          <div className="lp-wrap lp-hero-grid">
            <div className="lp-hero-copy">
              <p className="lp-kicker lp-for">For community-affairs teams</p>
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

        <ProofBand rows={proofRows} townCount={TOWNS.length === 6 ? "six" : String(TOWNS.length)} />
        <HowItWorks points={points} town={townLabel} outputs={outputs} draft={audit.map((r) => ({ text: r.text, kept: r.verdict === "grounded" }))} />
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
