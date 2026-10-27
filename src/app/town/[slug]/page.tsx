import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { TownView } from "@/components/TownView";
import { runTown } from "@/lib/run";
import { TOWNS } from "@/lib/towns";

export function generateStaticParams() {
  return TOWNS.map((t) => ({ slug: t.slug }));
}

export default async function TownPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ fund?: string; plan?: string }>;
}) {
  const [{ slug }, { fund, plan }] = await Promise.all([params, searchParams]);
  const run = await runTown(slug, Number(fund) || undefined, plan === "agency" ? "agency" : "llm");
  if (!run) notFound();
  return (
    <>
      <AppHeader active={slug} />
      <TownView run={run} />
    </>
  );
}
