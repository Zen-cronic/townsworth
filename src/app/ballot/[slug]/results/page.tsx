import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BallotResults } from "@/components/ballot/BallotResults";
import { BallotShell, ThinShortlist } from "@/components/ballot/BallotShell";
import { selectShortlist } from "@/lib/ballot";
import { runTown } from "@/lib/run";
import { companyFormHref, fundedByLine } from "@/lib/towns";

export const metadata: Metadata = { title: "Ballot tally · Good Neighbor", description: "Checks a facility's draft community plan line by line against the places the host town actually goes (Qloo taste data), and returns a costed, resident-ranked program." };

// Per request: never freeze a failed Qloo call into the page (see src/lib/qloo.ts).
export const dynamic = "force-dynamic";

export default async function BallotResultsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const run = await runTown(slug);
  if (!run) notFound();
  const { town, program } = run;
  const items = selectShortlist(program.items);
  const funder = { line: fundedByLine(town), placeholder: town.sponsorSource === "placeholder", fixHref: town.custom ? companyFormHref(town) : undefined };

  return (
    <BallotShell slug={town.slug} funder={funder} kicker={`Committee view · ${town.name}, ${town.region}`} title="How the shortlist ranks (sample tally)">
      {items.length < 2 ? (
        <ThinShortlist slug={town.slug} townName={town.name} count={items.length} />
      ) : (
        <BallotResults slug={town.slug} townName={town.name} items={items} />
      )}
    </BallotShell>
  );
}
