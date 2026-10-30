import "../ballot.css";
import type { Metadata } from "next";
import { PRODUCT_NAME } from "@/components/landing/brand";
import { notFound } from "next/navigation";
import { BallotForm } from "@/components/ballot/BallotForm";
import { LiveDataNotice } from "@/components/LiveDataNotice";
import { BallotShell, PrivacyLine, ThinShortlist } from "@/components/ballot/BallotShell";
import { BallotSplit } from "@/components/ballot/BallotSplit";
import { SHORTLIST_MIN, selectShortlist } from "@/lib/ballot";
import { runTown } from "@/lib/run";
import { companyFormHref, fundedByLine } from "@/lib/towns";

export const metadata: Metadata = { title: `Resident ballot · ${PRODUCT_NAME}`, description: "Checks a facility's draft community plan line by line against the places the host town actually goes (Qloo taste data), and returns a costed, resident-ranked program." };

// Per request: never freeze a failed Qloo call into the page (see src/lib/qloo.ts).
export const dynamic = "force-dynamic";

export default async function BallotPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const run = await runTown(slug);
  if (!run) notFound();
  const { town, program } = run;
  const items = selectShortlist(program.items);
  // A failed Qloo call shortens the list; say so instead of implying the town has few places.
  const failed = run.profile.failedCalls.length ? [town.name] : [];
  const funder = { line: fundedByLine(town), placeholder: town.sponsorSource === "placeholder", fixHref: town.custom ? companyFormHref(town) : undefined };

  return (
    <BallotShell slug={town.slug} funder={funder} kicker={`Resident ballot · ${town.name}, ${town.region}`} title={`Which should ${town.name}'s community fund do first?`}>
      {items.length < 2 ? (
        // Nothing to rank: the notice or the thin-shortlist note runs full width, as on the tally.
        <>
          <LiveDataNotice towns={failed} subject="this shortlist" className="mt-3" />
          {!failed.length && <ThinShortlist slug={town.slug} townName={town.name} count={items.length} />}
        </>
      ) : (
        <BallotSplit
          side={
            <>
              <p className="leading-relaxed">
                The community committee has a shortlist of {items.length} ideas for {town.name}. Put them in the order you&apos;d like to see
                them happen. The committee decides; your ranking informs it.
                {items.some((i) => i.bucket === "events") && " Every event is free and open to everyone."}
              </p>
              <PrivacyLine />
              <LiveDataNotice towns={failed} subject="this shortlist" className="mt-3" />
              {!failed.length && items.length < SHORTLIST_MIN && (
                <p className="mt-3 text-sm text-amber">
                  A short shortlist: Qloo found few local places near {town.name}, so only {items.length} ideas are ready for residents.
                </p>
              )}
            </>
          }
        >
          <BallotForm slug={town.slug} townName={town.name} items={items} />
        </BallotSplit>
      )}
    </BallotShell>
  );
}
