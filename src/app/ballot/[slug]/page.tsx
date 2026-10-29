import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BallotForm } from "@/components/ballot/BallotForm";
import { BallotShell, PrivacyLine, ThinShortlist } from "@/components/ballot/BallotShell";
import { SHORTLIST_MIN, selectShortlist } from "@/lib/ballot";
import { runTown } from "@/lib/run";
import { companyFormHref, fundedByLine } from "@/lib/towns";

export const metadata: Metadata = { title: "Resident ballot · Good Neighbor", description: "Checks a facility's draft community plan line by line against the places the host town actually goes (Qloo taste data), and returns a costed, resident-ranked program." };

// Per request: never freeze a failed Qloo call into the page (see src/lib/qloo.ts).
export const dynamic = "force-dynamic";

export default async function BallotPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const run = await runTown(slug);
  if (!run) notFound();
  const { town, program } = run;
  const items = selectShortlist(program.items);
  const funder = { line: fundedByLine(town), placeholder: town.sponsorSource === "placeholder", fixHref: town.custom ? companyFormHref(town) : undefined };

  return (
    <BallotShell slug={town.slug} funder={funder} kicker={`Resident ballot · ${town.name}, ${town.region}`} title={`Which should ${town.name}'s community fund do first?`}>
      <p className="mt-3 leading-relaxed">
        The community committee has a shortlist of {items.length} {items.length === 1 ? "idea" : "ideas"} for {town.name}. Put them in the order
        you&apos;d like to see them happen. The committee decides; your ranking informs it.
      </p>
      <PrivacyLine />
      {items.length >= 2 && items.length < SHORTLIST_MIN && (
        <p className="mt-3 text-sm text-amber">
          A short shortlist: Qloo found few local places near {town.name}, so only {items.length} ideas are ready for residents.
        </p>
      )}
      {items.length < 2 ? (
        <ThinShortlist slug={town.slug} townName={town.name} count={items.length} />
      ) : (
        <BallotForm slug={town.slug} townName={town.name} items={items} />
      )}
    </BallotShell>
  );
}
