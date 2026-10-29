import "server-only";
import { cache } from "react";
import { auditPlan, GENERIC_AGENCY_PLAN, isKept, type AuditInput, type AuditRow } from "./audit";
import { baselineFor, BASELINE, isInstitution } from "./baselineData";
import { liveLlmDraft } from "./liveDraft";
import { buildProfile, type TownProfile } from "./profile";
import { buildProgram, isReachItem, runWith, type Bucket, type Program, type ProgramItem } from "./plan";
import { applyReach } from "./reach";
import { townBySlug } from "./towns";

export type PlanSource = "llm" | "agency";

export const PLAN_LABEL: Record<PlanSource, string> = {
  llm: `AI-written plan (OpenAI ${BASELINE.model}, no Qloo data)`,
  agency: "Consultant template (sample)",
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

// Where the audited draft came from. Presets audit the frozen plan; a typed-in town audits the
// agency template unless the user asks for a live plain-LLM draft.
export type DraftOrigin = "frozen" | "live" | "template";

export interface DraftInfo {
  origin: DraftOrigin;
  notice?: string;
  live?: { model: string; createdAt: string; llmMs: number; osmMs: number; osmFailures: number };
}

// Audits one draft against a town: verdicts, then kept institutions run their bucket's items, then
// the Qloo partners the draft never named. Mutates `program.items` (runWith), as runTown always did.
export function auditDraft(inputs: AuditInput[], profile: TownProfile, program: Program): { audit: AuditRow[]; qlooAdds: ProgramItem[] } {
  const audit = auditPlan(inputs, profile, program.items);

  // Where the draft named an institution the audit kept (the technical college, the county EDC),
  // that institution runs the bucket's items and the Qloo place hosts them. Grants go to applicants.
  const RUN_WITH: Bucket[] = ["training", "procurement", "events", "channels"];
  for (const bucket of RUN_WITH) {
    const lead = audit.find((a) => a.bucket === bucket && isKept(a.verdict) && a.named && isInstitution(a.named));
    if (lead?.named) program.items.filter((it) => it.bucket === bucket && !isReachItem(it)).forEach((it) => runWith(it, lead.named!));
  }

  // Partners Qloo surfaces that the audited draft never named. Age-group sessions are listed by the
  // age-group check, not here.
  const draftText = norm(inputs.map((i) => `${i.named ?? ""} ${i.text}`).join(" "));
  const usedIds = new Set(audit.flatMap((a) => [a.replacement?.id, a.alongside?.id]).filter(Boolean));
  const qlooAdds: ProgramItem[] = program.items.filter(
    (it) => !usedIds.has(it.id) && !isReachItem(it) && it.partner && !draftText.includes(norm(it.partner.name)),
  );

  return { audit, qlooAdds };
}

// One deterministic run for a town: Qloo profile -> program -> audit of the chosen draft plan.
// `live` only matters for a typed-in town with source "llm": it drafts the plan with OpenAI now.
export const runTown = cache(async (slug: string, fund?: number, source: PlanSource = "llm", live = false) => {
  const town = townBySlug(slug);
  if (!town) return null;
  const annualFund = fund && fund > 0 ? fund : town.defaultAnnualFund;
  const frozen = baselineFor(town.slug);
  const wantLive = source === "llm" && !frozen.length && live && !!town.custom;
  const [profile, liveResult] = await Promise.all([
    buildProfile(town),
    wantLive
      ? liveLlmDraft(town.slug).then(
          (d) => ({ ok: true as const, d }),
          (e: unknown) => ({ ok: false as const, reason: e instanceof Error ? e.message : "unknown error" }),
        )
      : null,
  ]);
  const program = buildProgram(profile, annualFund);

  let inputs: AuditInput[] = GENERIC_AGENCY_PLAN.map((text) => ({ text }));
  let used: PlanSource = "agency";
  const draft: DraftInfo = { origin: "template" };
  if (source === "llm" && frozen.length) {
    inputs = frozen.map((b) => ({ text: b.item, named: b.partner, osm: b.osm }));
    used = "llm";
    draft.origin = "frozen";
  } else if (liveResult?.ok) {
    const d = liveResult.d;
    inputs = d.items.map((b) => ({ text: b.item, named: b.partner, osm: b.osm }));
    used = "llm";
    draft.origin = "live";
    draft.live = { model: d.model, createdAt: d.createdAt, llmMs: d.llmMs, osmMs: d.osmMs, osmFailures: d.osmFailures };
  } else if (liveResult && !liveResult.ok) {
    draft.notice = `The live AI-written draft didn't finish (${liveResult.reason.slice(0, 100)}), so this checks the consultant template instead.`;
  }
  const { audit, qlooAdds } = auditDraft(inputs, profile, program);
  // After the audit, so the age-group sessions never become a swap or a run-with target.
  applyReach(profile, program);

  return { town, profile, program, audit, source: used, qlooAdds, draft };
});

export type TownRun = NonNullable<Awaited<ReturnType<typeof runTown>>>;

export const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
