import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BallotResults } from "@/components/ballot/BallotResults";
import { BallotShell, ThinShortlist } from "@/components/ballot/BallotShell";
import { selectShortlist } from "@/lib/ballot";
import { runTown } from "@/lib/run";

export const metadata: Metadata = { title: "Ballot tally · Good Neighbor" };

export default async function BallotResultsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const run = await runTown(slug);
  if (!run) notFound();
  const { town, program } = run;
  const items = selectShortlist(program.items);

  return (
    <BallotShell slug={town.slug} kicker={`Committee view · ${town.name}, ${town.region}`} title="How the shortlist ranks">
      {items.length < 2 ? (
        <ThinShortlist slug={town.slug} townName={town.name} count={items.length} />
      ) : (
        <BallotResults slug={town.slug} townName={town.name} items={items} />
      )}
    </BallotShell>
  );
}
