import "server-only";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, isStepCount, Output, tool } from "ai";
import { z } from "zod";
import { categories, splitSafe } from "./filters";
import { osmLookup } from "./nominatim";
import { BUCKETS, cleanName, type ProgramItem } from "./plan";
import { placesNear } from "./qloo";
import type { TownRun } from "./run";
import { companyFormHref, namesSponsor, sponsorSignature, type Town } from "./towns";

// The agent proposes; code decides. It reads the deterministic program, picks partners, checks
// each one in OpenStreetMap (independent of the Qloo list they came from), reads local taste and
// drafts outreach. Code then rule-checks every draft before it is shown.

export const AGENT_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const MAX_CHECKS = 6;

const outputSchema = z.object({
  summary: z.string().describe("Four plain sentences for the memo: what the program funds and why it fits this town"),
  drafts: z
    .array(
      z.object({
        itemId: z.string().describe("The itemId from get_program"),
        partner: z.string().describe("Exact partner name as returned by get_program"),
        reason: z.string().describe("One line: why you chose this partner"),
        localSignal: z.string().describe("The one local signal used in the email, copied exactly from local_taste or local_places"),
        subject: z.string(),
        body: z.string().describe("Short, warm email. Under 150 words. Names the sponsor in the first paragraph and ends with the exact signature line."),
      }),
    )
    .max(3),
  dropped: z
    .array(z.object({ partner: z.string(), reason: z.string() }))
    .describe("Partners you considered and dropped, e.g. because check_partner returned found:false"),
});

export interface TraceStep {
  tool: string;
  input: unknown;
  resultSize: number;
  found?: boolean;
  detail?: string;
  // Set when code ran the check because the agent drafted without it.
  by?: "code";
}

export interface IndependentCheck {
  found: boolean;
  by: "agent" | "code";
  osmName?: string;
  km?: number;
  unavailable?: boolean;
}

export interface RuleResult {
  inProgram: boolean;
  sponsorInBody: boolean;
  sponsorInSignature: boolean;
  topic?: string;
}

export interface AgentDraft {
  partner: string;
  itemTitle: string;
  bucket: string;
  reason?: string;
  localSignal?: string;
  signalVerified: boolean;
  subject: string;
  body: string;
  checked: "passed" | "replaced";
  rules: RuleResult;
  independent: IndependentCheck;
  note?: string;
}

// Land-use, approval and political language is never allowed in outreach. Event logistics
// ("event permit", "looking forward to hearing from you") are fine.
const FORBIDDEN: [string, RegExp][] = [
  ["votes or elections", /\b(vote|votes|voting|voters?|elections?|referend(um|a))\b/i],
  ["zoning or land use", /\b(zoning|rezon\w*|land[- ]use|variances?|annexation|planning commission|site plan)\b/i],
  ["hearings or council business", /\b((public|zoning|council|board|planning|county|city|town|village) hearings?|hearings|public comment|council meetings?|city council|town board|village board|county board)\b/i],
  ["project permits", /\b((building|zoning|construction|conditional[- ]use|special[- ]use|land[- ]use|site|environmental|air|water|wastewater|discharge|grading|project) permits?|permitting)\b/i],
  ["project approval", /\b((project|site|regulatory|zoning|board|council) approvals?|approv\w* (of|for) (the|our|this) (project|campus|facility|plant|data cent(er|re)|fab)|support (the|our|this) (project|campus|facility|plant|data cent(er|re)|fab))\b/i],
  ["politics", /\b(politic\w*|partisan|democrat\w*|republican\w*|liberal party|conservative party)\b/i],
  ["religion", /\b(church\w*|mosque\w*|synagogue\w*|religio\w*|faith[- ]based|prayer\w*|worship)\b/i],
  ["dollar amounts", /\$\s?\d|\b\d[\d,.]*\s?(dollars|usd|cad)\b/i],
];

export function forbiddenTopic(text: string): string | undefined {
  return FORBIDDEN.find(([, re]) => re.test(text))?.[0];
}

type SponsorTown = Pick<Town, "name" | "facility" | "sponsor">;

// The sponsor must appear in the opening of the email and in its sign-off (the last two non-empty lines).
export function checkDraft(d: { subject: string; body: string }, town: SponsorTown, inProgram = true): RuleResult {
  const lines = d.body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const signature = lines.slice(-2).join("\n");
  const opening = lines.slice(0, -2).join("\n");
  return {
    inProgram,
    sponsorInBody: lines.length > 2 && namesSponsor(opening, town.sponsor),
    sponsorInSignature: namesSponsor(signature, town.sponsor),
    topic: forbiddenTopic(`${d.subject}\n${d.body}`),
  };
}

export const rulesPass = (r: RuleResult) => r.inProgram && r.sponsorInBody && r.sponsorInSignature && !r.topic;

function failNote(r: RuleResult) {
  const why = [
    !r.inProgram && "named a partner outside the program",
    !r.sponsorInBody && "didn't name the sponsor in the email",
    !r.sponsorInSignature && "didn't name the sponsor in the signature",
    r.topic && `mentioned ${r.topic}`,
  ].filter(Boolean);
  return `The agent's draft ${why.join(", ")}; replaced with the template.`;
}

const teamPhrase = (town: SponsorTown) => sponsorSignature(town).replace(/^Sent on behalf of /, "");

export function templateDraft(town: SponsorTown & Pick<Town, "region">, item: Pick<ProgramItem, "title" | "partner">): { subject: string; body: string } {
  const name = item.partner?.name ?? "your team";
  const team = teamPhrase(town);
  return {
    subject: `${item.title}: an invitation from ${team}`,
    body: [
      `Hello ${name} team,`,
      "",
      `I'm writing from ${team}, which runs the community program in ${town.name}, ${town.region}. We'd like to explore "${item.title.toLowerCase()}" with you as a local partner.`,
      "Would you be open to a 15-minute call in the next few weeks to see whether dates, space and costs work for you? There's no commitment.",
      "",
      "Best,",
      sponsorSignature(town),
    ].join("\n"),
  };
}

const lower = (s: string) => s.toLowerCase().trim();

export async function runAgent(run: TownRun) {
  const { town, program, profile } = run;
  const items: ProgramItem[] = Array.isArray(program?.items) ? program.items : [];
  const partnered = items.filter((i) => i.partner?.name);
  const signature = sponsorSignature(town);
  const trace: TraceStep[] = [];
  const checks = new Map<string, IndependentCheck>();
  const codeChecks: TraceStep[] = [];
  const signals = new Set<string>();
  let checksLeft = MAX_CHECKS;

  const findItem = (itemId: string | undefined, partner: string) =>
    partnered.find((i) => i.id === itemId && lower(i.partner!.name) === lower(partner)) ?? partnered.find((i) => lower(i.partner!.name) === lower(partner));

  async function independentCheck(name: string, by: IndependentCheck["by"]): Promise<IndependentCheck> {
    const hit = await osmLookup(name, town);
    const c: IndependentCheck = { found: hit.found, by, osmName: hit.osmName, km: hit.km, unavailable: hit.status !== 200 || undefined };
    checks.set(lower(name), c);
    if (by === "code") {
      const detail = c.found ? `${c.osmName ?? "match"}${c.km != null ? `, ${c.km} km` : ""}` : c.unavailable ? "OpenStreetMap didn't answer" : "not in OpenStreetMap within 25 km";
      codeChecks.push({ tool: "check_partner", input: { name }, resultSize: 1, found: c.found, detail, by: "code" });
    }
    return c;
  }

  const tools = {
    get_program: tool({
      description: "The decided 24-month program for this town: items, buckets, partners and the Qloo signal behind each. The source of truth.",
      inputSchema: z.object({}),
      execute: async () =>
        items.map((i) => ({
          itemId: i.id,
          title: i.title,
          bucket: i.bucket,
          bucketLabel: BUCKETS[i.bucket]?.label ?? i.bucket,
          partner: i.partner?.name ?? null,
          distanceKm: i.partner?.distanceKm ?? null,
          signal: i.provenance?.[0]?.signal ?? null,
          signalDetail: i.provenance?.[0]?.detail ?? null,
        })),
    }),
    local_places: tool({
      description: "Live Qloo places near the site, with categories and distance (political and religious places removed). Local context for the emails.",
      inputSchema: z.object({ radiusKm: z.number().min(1).max(25).default(15) }),
      execute: async ({ radiusKm }) => {
        const res = await placesNear(town.lat, town.lon, radiusKm * 1000, 20);
        const kept = splitSafe(res.entities).kept;
        return kept.map((e) => {
          const name = cleanName(e.name);
          signals.add(lower(name));
          return { name, categories: categories(e).slice(0, 3), km: e.distanceM ? Math.round(e.distanceM / 100) / 10 : null };
        });
      },
    }),
    local_taste: tool({
      description: "What this town distinctly over-indexes on (aggregate Qloo affinities). Pick one to mention in each email.",
      inputSchema: z.object({ type: z.enum(["brand", "artist", "tv_show", "podcast"]) }),
      execute: async ({ type }) => {
        const list = profile?.taste?.[type] ?? [];
        const names = list
          .filter((s) => s?.distinct && s.entity?.name)
          .map((s) => s.entity.name)
          .filter((n) => !forbiddenTopic(n))
          .slice(0, 8);
        names.forEach((n) => signals.add(lower(n)));
        return names;
      },
    }),
    check_partner: tool({
      description:
        "Independently confirm a program partner exists near the site, in OpenStreetMap (not Qloo), within 25 km. Returns found:false when OpenStreetMap has no match. Call it for every partner before writing to them.",
      inputSchema: z.object({ name: z.string() }),
      execute: async ({ name }) => {
        if (!partnered.some((i) => lower(i.partner!.name) === lower(name))) return { found: false, reason: "Not a partner in the program" };
        const prior = checks.get(lower(name));
        if (prior) return { found: prior.found, osmName: prior.osmName ?? null, km: prior.km ?? null };
        if (checksLeft <= 0) return { found: false, reason: "Check budget used up; draft for partners already confirmed" };
        checksLeft--;
        const c = await independentCheck(name, "agent");
        return c.unavailable
          ? { found: false, reason: "OpenStreetMap didn't answer" }
          : { found: c.found, osmName: c.osmName ?? null, km: c.km ?? null, source: "OpenStreetMap Nominatim, 25 km" };
      },
    }),
  };

  const buckets = Array.from(new Set(partnered.map((i) => i.bucket)));

  const result = await generateText({
    model: createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(AGENT_MODEL),
    tools,
    stopWhen: isStepCount(10),
    output: Output.object({ schema: outputSchema }),
    system: [
      `You are the community-program assistant for ${town.sponsor}, which funds the community program around its ${town.facility} in ${town.name}, ${town.region}.`,
      "1. Call get_program. 2. Call local_taste (at least once) and optionally local_places for local context.",
      "3. Choose up to 3 partners yourself from the program items that have a partner, from at least two different buckets, and give a one-line reason for each.",
      "4. Call check_partner for each chosen partner. It checks OpenStreetMap, which is independent of Qloo. If it returns found:false, drop that partner (list it in dropped with the reason) and choose another if one fits; call check_partner on the replacement too before drafting. Only draft to partners check_partner returned found:true for.",
      "5. Draft one email per kept partner. Work exactly one genuine local signal from local_taste or local_places into each email, naturally, as something people in town love (never call it a signal or data), and put it in localSignal exactly as the tool returned it. Never use a political or religious signal.",
      `Every email must name ${town.sponsor} in its first paragraph, and must end with "Best," followed by this exact last line: "${signature}".`,
      "Be warm and plain, and offer a short call. Never mention dollar amounts or budgets: the program amount is the item's budget, not a payment to the partner.",
      "Never mention votes, elections, zoning, land use, project permits, hearings, council business, project approval, politics or religion. Event logistics are fine. Never invent facts that no tool returned.",
      partnered.length ? "" : "The program has no partners, so return no drafts.",
    ].join(" "),
    prompt: `Choose partners for ${town.name} (the program has partners in these buckets: ${buckets.join(", ") || "none"}), check each, draft outreach, then write the memo summary.`,
  });

  for (const step of result.steps) {
    for (const call of step.toolCalls) {
      const tr = step.toolResults.find((r) => r.toolCallId === call.toolCallId);
      const out = tr && "output" in tr ? (tr.output as unknown) : undefined;
      const t: TraceStep = { tool: call.toolName, input: call.input, resultSize: Array.isArray(out) ? out.length : out ? 1 : 0 };
      if (call.toolName === "check_partner" && out && typeof out === "object") {
        const o = out as { found?: boolean; osmName?: string | null; km?: number | null; reason?: string };
        t.found = !!o.found;
        t.detail = o.found ? `${o.osmName ?? "match"}${o.km != null ? `, ${o.km} km` : ""}` : o.reason;
      }
      if (call.toolName === "local_taste" && Array.isArray(out)) t.detail = (out as string[]).slice(0, 3).join(", ");
      trace.push(t);
    }
  }

  const output = result.output;
  const drafts: AgentDraft[] = [];
  const rejected: { partner: string; reason: string }[] = [];
  const seen = new Set<string>();

  for (const d of output.drafts) {
    const item = findItem(d.itemId, d.partner);
    if (!item) {
      rejected.push({ partner: d.partner, reason: "Not a partner in the program, so code dropped the draft." });
      continue;
    }
    const name = item.partner!.name;
    if (seen.has(lower(name))) continue;
    seen.add(lower(name));

    const independent = checks.get(lower(name)) ?? (await independentCheck(name, "code"));
    const sig = d.localSignal?.trim();
    const signalVerified = !!sig && signals.has(lower(sig)) && lower(sig) !== lower(name) && lower(d.body).includes(lower(sig));
    const rules = checkDraft(d, town, true);
    const base = {
      partner: name,
      itemTitle: item.title,
      bucket: BUCKETS[item.bucket]?.label ?? String(item.bucket),
      reason: d.reason,
      independent,
    };
    if (rulesPass(rules)) {
      drafts.push({ ...base, localSignal: sig, signalVerified, subject: d.subject, body: d.body, checked: "passed", rules });
    } else {
      const t = templateDraft(town, item);
      drafts.push({ ...base, signalVerified: false, ...t, checked: "replaced", rules, note: failNote(rules) });
    }
  }

  // The agent gave nothing usable but the program has partners: code writes labelled templates.
  if (!drafts.length && partnered.length) {
    const picks = buckets.map((b) => partnered.find((i) => i.bucket === b)!).slice(0, 2);
    for (const item of picks) {
      const independent = checks.get(lower(item.partner!.name)) ?? (await independentCheck(item.partner!.name, "code"));
      const t = templateDraft(town, item);
      drafts.push({
        partner: item.partner!.name,
        itemTitle: item.title,
        bucket: BUCKETS[item.bucket]?.label ?? String(item.bucket),
        independent,
        signalVerified: false,
        ...t,
        checked: "replaced",
        rules: checkDraft(t, town, true),
        note: "The agent returned no usable drafts; this is the labelled template.",
      });
    }
  }

  // Every partner the independent check couldn't confirm and that has no draft.
  const agentReasons = new Map(output.dropped.map((x) => [lower(x.partner), x.reason]));
  for (const [key, c] of checks) {
    if (c.found || drafts.some((d) => lower(d.partner) === key)) continue;
    const item = partnered.find((i) => lower(i.partner!.name) === key);
    rejected.push({
      partner: item?.partner?.name ?? key,
      reason: c.unavailable
        ? "OpenStreetMap didn't answer, so no draft was written."
        : `Not in OpenStreetMap within 25 km, so ${agentReasons.has(key) ? "the agent dropped it" : "no draft was written"}.`,
    });
  }

  trace.push(...codeChecks);

  const draftBuckets = new Set(drafts.map((d) => d.bucket));
  const bucketNote =
    drafts.length >= 2 && draftBuckets.size < 2
      ? buckets.length >= 2
        ? "The agent chose partners from only one program bucket."
        : "The program has partners in only one bucket here, so every draft comes from it."
      : undefined;

  const summaryOk = !forbiddenTopic(output.summary);
  return {
    model: AGENT_MODEL,
    sponsor: town.sponsor,
    sponsorSource: town.sponsorSource,
    signature,
    companyHref: town.sponsorSource === "placeholder" ? companyFormHref(town) : undefined,
    summary: summaryOk ? output.summary : "Summary withheld: it mentioned a topic outreach never covers.",
    drafts,
    rejected,
    bucketNote,
    trace,
    steps: result.steps.length,
  };
}
