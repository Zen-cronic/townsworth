import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { TownView } from "@/components/TownView";
import { runTown } from "@/lib/run";
import { HERO_TOWN } from "@/lib/towns";

export default async function Home({ searchParams }: { searchParams: Promise<{ fund?: string; plan?: string }> }) {
  const { fund, plan } = await searchParams;
  const run = await runTown(HERO_TOWN.slug, Number(fund) || undefined, plan === "agency" ? "agency" : "llm");
  if (!run) notFound();
  return (
    <>
      <AppHeader active={HERO_TOWN.slug} />
      <TownView run={run} />
    </>
  );
}
