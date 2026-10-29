import "server-only";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import type { AuditInput, AuditRow } from "./audit";
import { LIVE_MODEL } from "./liveDraft";
import { osmLookup } from "./nominatim";
import { buildProfile } from "./profile";
import { buildProgram, type ProgramItem } from "./plan";
import { auditDraft } from "./run";
import type { Town } from "./towns";
import { groundModelItems, modelPlanSchema, SHORT_INPUT, splitPlanLines, userPlanMessage, userPlanPrompt, userPlanSchema } from "./userPlanParse";

// "Check your own plan": the pasted text is split into items (OpenAI, then grounded against the
// text), each named organisation is looked up on OpenStreetMap, and the same deterministic audit
// as /town runs. The text is never logged, cached or stored; only the town's coordinates go to Qloo.

const OSM_PARTNERS = 8;

export interface PlanParse {
  inputs: AuditInput[];
  method: "model" | "lines";
  model?: string;
  ms: number;
  notice?: string;
  truncated?: boolean;
}

function byLines(text: string, started: number, notice?: string): PlanParse {
  const { items, truncated } = splitPlanLines(text);
  return { inputs: items.map((t) => ({ text: t, named: null })), method: "lines", ms: Date.now() - started, notice, truncated };
}

// Not cached: each call is a fresh parse of text that must not outlive the request.
export async function parsePlan(text: string, town: Pick<Town, "name" | "region">): Promise<PlanParse> {
  const started = Date.now();
  // Deterministic parse for local tests and smoke runs; never active on Vercel.
  if (process.env.CHECK_MODEL_FIXTURE === "1" && !process.env.VERCEL) {
    return { ...byLines(text, started), method: "model", model: "fixture" };
  }
  if (text.trim().length < SHORT_INPUT) return byLines(text, started, "A short draft is split line by line, without a model call.");
  const key = process.env.OPENAI_API_KEY;
  if (!key) return byLines(text, started, "The model isn't configured here, so the draft was split line by line.");
  try {
    const { output } = await generateText({
      model: createOpenAI({ apiKey: key })(LIVE_MODEL),
      output: Output.object({ schema: modelPlanSchema }),
      system: userPlanPrompt(town),
      prompt: userPlanMessage(text),
      abortSignal: AbortSignal.timeout(45_000),
      maxRetries: 1,
      providerOptions: { openai: { store: false } },
    });
    const parsed = userPlanSchema.safeParse({ items: output.items.map((i) => ({ item: i.item.slice(0, 400), partner: i.partner })) });
    if (!parsed.success) return byLines(text, started, "The model's split didn't match the expected shape, so the draft was split line by line.");
    const inputs = groundModelItems(text, parsed.data.items);
    if (!inputs.length) return byLines(text, started, "None of the model's items matched your text, so the draft was split line by line.");
    const dropped = parsed.data.items.length - inputs.length;
    return {
      inputs,
      method: "model",
      model: LIVE_MODEL,
      ms: Date.now() - started,
      notice: dropped > 0 ? `${dropped} ${dropped === 1 ? "item" : "items"} the model returned didn't match your wording and ${dropped === 1 ? "was" : "were"} dropped.` : undefined,
    };
  } catch (e) {
    // Only the error class: provider errors can carry the request body.
    const kind = e instanceof Error ? e.name : "error";
    return byLines(text, started, `OpenAI didn't finish the split (${kind}), so the draft was split line by line.`);
  }
}

export interface CheckResult {
  town: Town;
  annualFund: number;
  parse: { method: PlanParse["method"]; model?: string; ms: number; notice?: string; truncated?: boolean; items: number };
  osm: { checked: number; failures: number; ms: number };
  audit: AuditRow[];
  qlooAdds: ProgramItem[];
  program: { items: ProgramItem[]; totalAllocated: number; unassigned: number; twoYearFund: number; costNote: string };
  profile: { thin: boolean; localPlaces: number; excluded: number; failedCalls: number; calls: { label: string; status: number; ok: boolean; count: number }[] };
  ms: number;
}

const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export async function runUserPlan(town: Town, fund: number | undefined, text: string): Promise<CheckResult> {
  const started = Date.now();
  const annualFund = fund && fund > 0 ? fund : town.defaultAnnualFund;
  // Qloo sees only the town's coordinates; its responses are data-cached per town.
  const [profile, parse] = await Promise.all([buildProfile(town), parsePlan(text, town)]);
  const program = buildProgram(profile, annualFund);

  // OpenStreetMap check for the first few named organisations, kept out of the data cache.
  const osmStarted = Date.now();
  const checks = new Map<string, Awaited<ReturnType<typeof osmLookup>>>();
  for (const input of parse.inputs) {
    const key = input.named ? normName(input.named) : "";
    if (!key || key === normName(town.name) || checks.has(key) || checks.size >= OSM_PARTNERS) continue;
    checks.set(key, await osmLookup(input.named!, town, { noStore: true }));
  }
  const inputs = parse.inputs.map((i) => ({ ...i, osm: i.named ? (checks.get(normName(i.named)) ?? null) : null }));
  const failures = [...checks.values()].filter((c) => c.status !== 200).length;

  const { audit, qlooAdds } = auditDraft(inputs, profile, program);
  return {
    town,
    annualFund,
    parse: { method: parse.method, model: parse.model, ms: parse.ms, notice: parse.notice, truncated: parse.truncated, items: parse.inputs.length },
    osm: { checked: checks.size, failures, ms: Date.now() - osmStarted },
    audit,
    qlooAdds,
    program: {
      items: program.items,
      totalAllocated: program.totalAllocated,
      unassigned: program.unassigned,
      twoYearFund: program.twoYearFund,
      costNote: program.costNote,
    },
    profile: {
      thin: profile.thin,
      localPlaces: profile.localPlaces.length,
      excluded: profile.excluded.length,
      failedCalls: profile.failedCalls.length,
      calls: profile.calls.map((c) => ({ label: c.label, status: c.status, ok: c.ok, count: c.count })),
    },
    ms: Date.now() - started,
  };
}
