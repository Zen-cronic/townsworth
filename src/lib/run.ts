import "server-only";
import { cache } from "react";
import { auditPlan, GENERIC_AGENCY_PLAN, type AuditInput } from "./audit";
import { baselineFor, BASELINE } from "./baselineData";
import { buildProfile } from "./profile";
import { buildProgram, type ProgramItem } from "./plan";
import { townBySlug } from "./towns";

export type PlanSource = "llm" | "agency";

export const PLAN_LABEL: Record<PlanSource, string> = {
  llm: `Plain-LLM plan (OpenAI ${BASELINE.model}, no Qloo)`,
  agency: "Typical agency plan (sample)",
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

// One deterministic run for a town: Qloo profile -> program -> audit of the chosen draft plan.
export const runTown = cache(async (slug: string, fund?: number, source: PlanSource = "llm") => {
  const town = townBySlug(slug);
  if (!town) return null;
  const annualFund = fund && fund > 0 ? fund : town.defaultAnnualFund;
  const profile = await buildProfile(town);
  const program = buildProgram(profile, annualFund);

  const baseline = baselineFor(slug);
  const inputs: AuditInput[] =
    source === "llm"
      ? baseline.map((b) => ({ text: b.item, named: b.partner, osm: b.osm }))
      : GENERIC_AGENCY_PLAN.map((text) => ({ text }));
  const audit = auditPlan(inputs, profile, program.items);

  // Partners Qloo surfaces that the audited draft never named.
  const draftText = norm(inputs.map((i) => `${i.named ?? ""} ${i.text}`).join(" "));
  const used = new Set(audit.map((a) => a.replacement?.id).filter(Boolean));
  const qlooAdds: ProgramItem[] = program.items.filter(
    (it) => !used.has(it.id) && it.partner && !draftText.includes(norm(it.partner.name)),
  );

  return { town, profile, program, audit, source, qlooAdds };
});

export type TownRun = NonNullable<Awaited<ReturnType<typeof runTown>>>;

export const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
