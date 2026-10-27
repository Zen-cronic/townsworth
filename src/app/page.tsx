import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { TownView } from "@/components/TownView";
import { runTown } from "@/lib/run";
import { HERO_TOWN } from "@/lib/towns";

export default async function Home({ searchParams }: { searchParams: Promise<{ fund?: string }> }) {
  const { fund } = await searchParams;
  const run = await runTown(HERO_TOWN.slug, Number(fund) || undefined);
  if (!run) notFound();
  return (
    <>
      <AppHeader active={HERO_TOWN.slug} />
      <TownView run={run} />
    </>
  );
}
