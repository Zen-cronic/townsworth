import "server-only";
import { cache } from "react";
import { auditPlan, GENERIC_AGENCY_PLAN } from "./audit";
import { buildProfile } from "./profile";
import { buildProgram } from "./plan";
import { townBySlug } from "./towns";

// One deterministic run for a town: Qloo profile -> program -> audit of the generic plan.
export const runTown = cache(async (slug: string, fund?: number) => {
  const town = townBySlug(slug);
  if (!town) return null;
  const annualFund = fund && fund > 0 ? fund : town.defaultAnnualFund;
  const profile = await buildProfile(town);
  const program = buildProgram(profile, annualFund);
  const audit = auditPlan(GENERIC_AGENCY_PLAN.map((text) => ({ text })), profile, program.items);
  return { town, profile, program, audit };
});

export type TownRun = NonNullable<Awaited<ReturnType<typeof runTown>>>;

export const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
