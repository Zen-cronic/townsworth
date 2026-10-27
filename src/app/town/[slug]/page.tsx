import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { TownLoading } from "@/components/TownLoading";
import { TownView } from "@/components/TownView";
import { runTown, type PlanSource } from "@/lib/run";
import { TOWNS, townBySlug } from "@/lib/towns";
import { parseFund } from "@/components/dashboard/ui";

// A live plain-LLM draft for a typed-in town takes about 20 s (OpenAI, then one OSM check a second).
export const maxDuration = 60;

export function generateStaticParams() {
  return TOWNS.map((t) => ({ slug: t.slug }));
}

async function TownBody({ slug, fund, source, live }: { slug: string; fund?: number; source: PlanSource; live: boolean }) {
  const run = await runTown(slug, fund, source, live);
  if (!run) notFound();
  return <TownView run={run} />;
}

export default async function TownPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ fund?: string; plan?: string }>;
}) {
  const [{ slug }, { fund, plan }] = await Promise.all([params, searchParams]);
  // Checked before streaming starts, so an unknown or malformed slug is a real 404.
  const town = townBySlug(slug);
  if (!town) notFound();
  // Presets audit their frozen LLM plan by default. A typed-in town has none, so it audits the
  // agency template unless `?plan=llm` asks for a live draft.
  const source: PlanSource = town.custom ? (plan === "llm" ? "llm" : "agency") : plan === "agency" ? "agency" : "llm";
  const live = !!town.custom && plan === "llm";
  const amount = parseFund(fund);
  return (
    <>
      <AppHeader active={slug} />
      <Suspense key={`${source}-${amount ?? ""}`} fallback={<TownLoading live={live} />}>
        <TownBody slug={slug} fund={amount} source={source} live={live} />
      </Suspense>
    </>
  );
}
