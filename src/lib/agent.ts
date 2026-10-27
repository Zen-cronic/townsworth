import "server-only";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, isStepCount, Output, tool } from "ai";
import { z } from "zod";
import { categories } from "./filters";
import { cleanName, type ProgramItem } from "./plan";
import { placesNear } from "./qloo";
import type { TownRun } from "./run";

// The agent drafts; code decides. It reads the deterministic program through tools, may look up
// Qloo for context, and writes outreach. Every draft is checked by rules before it is shown.

export const AGENT_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

const outputSchema = z.object({
  summary: z.string().describe("Four plain sentences for the memo: what the program funds and why it fits this town"),
  drafts: z
    .array(
      z.object({
        partner: z.string().describe("Exact partner name as returned by get_program"),
        subject: z.string(),
        body: z.string().describe("Short, warm email from the sponsor's community team. Under 140 words."),
      }),
    )
    .min(1)
    .max(3),
});

export interface TraceStep {
  tool: string;
  input: unknown;
  resultSize: number;
}

export interface AgentDraft {
  partner: string;
  subject: string;
  body: string;
  checked: "passed" | "replaced";
  note?: string;
}

const FORBIDDEN = /\b(vote|voting|zoning|rezon\w*|permit|hearing|election|council meeting|support (the|our) project|approval|church|politic\w*|religio\w*)\b|\$\s?\d/i;

function templateDraft(item: ProgramItem, sponsor: string): Omit<AgentDraft, "checked"> {
  const name = item.partner?.name ?? "your team";
  return {
    partner: name,
    subject: `${item.title}: an invitation from the ${sponsor} community team`,
    body: [
      `Hello ${name} team,`,
      "",
      `We run the community program for the ${sponsor}. We'd like to explore "${item.title.toLowerCase()}" with you as a local partner.`,
      "Would you be open to a 15-minute call in the next few weeks to see whether dates, space and costs work for you? There's no commitment.",
      "",
      `Best,\nCommunity team, ${sponsor}`,
    ].join("\n"),
  };
}

export async function runAgent(run: TownRun) {
  const { town, program, profile } = run;
  const sponsor = `${town.name} ${town.facility}`;
  const trace: TraceStep[] = [];
  const partnered = program.items.filter((i) => i.partner).slice(0, 3);
  const allowedPartners = new Set(program.items.map((i) => i.partner?.name).filter(Boolean) as string[]);

  const tools = {
    get_program: tool({
      description: "The decided 24-month program for this town: items, partners, amounts and Qloo provenance. The source of truth.",
      inputSchema: z.object({}),
      execute: async () =>
        program.items.map((i) => ({
          title: i.title,
          bucket: i.bucket,
          partner: i.partner?.name ?? null,
          distanceKm: i.partner?.distanceKm ?? null,
          amountUsd: i.amount,
          signal: i.provenance[0]?.signal,
          signalDetail: i.provenance[0]?.detail,
        })),
    }),
    local_places: tool({
      description: "Qloo places near the site, with categories and distance. Use for local context only.",
      inputSchema: z.object({ radiusKm: z.number().min(1).max(25).default(15) }),
      execute: async ({ radiusKm }) => {
        const res = await placesNear(town.lat, town.lon, radiusKm * 1000, 20);
        return res.entities.map((e) => ({ name: cleanName(e.name), categories: categories(e).slice(0, 3), km: e.distanceM ? Math.round(e.distanceM / 100) / 10 : null }));
      },
    }),
    local_taste: tool({
      description: "What this town distinctly over-indexes on (aggregate Qloo affinities: brands, artists, TV, podcasts).",
      inputSchema: z.object({ type: z.enum(["brand", "artist", "tv_show", "podcast"]) }),
      execute: async ({ type }) => profile.taste[type].filter((s) => s.distinct).slice(0, 8).map((s) => s.entity.name),
    }),
    check_partner: tool({
      description: "Confirm a partner exists in this town's Qloo local data before writing to them.",
      inputSchema: z.object({ name: z.string() }),
      execute: async ({ name }) => {
        const hit = profile.places.find((p) => cleanName(p.name).toLowerCase() === name.toLowerCase());
        return hit ? { found: true, address: hit.address ?? null, phone: hit.phone ?? null } : { found: false };
      },
    }),
  };

  const result = await generateText({
    model: createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(AGENT_MODEL),
    tools,
    stopWhen: isStepCount(6),
    output: Output.object({ schema: outputSchema }),
    system: [
      `You are the community-program assistant for ${sponsor} in ${town.name}, ${town.region}.`,
      "Call get_program first. Write outreach only to partners that appear in the program, and confirm each with check_partner.",
      "Write as the sponsor's community team, warm and plain. Offer a short call. Never mention dollar amounts or budgets in outreach: the program amount is the item's budget (instructors, stipends, venue hire), not a payment to the partner.",
      "Never mention votes, zoning, permits, hearings, approval, politics or religion. Never invent facts that no tool returned.",
    ].join(" "),
    prompt: `Draft outreach emails for these partners: ${partnered.map((p) => p.partner?.name).join("; ")}. Then write the memo summary.`,
  });

  for (const step of result.steps) {
    for (const call of step.toolCalls) {
      const tr = step.toolResults.find((r) => r.toolCallId === call.toolCallId);
      const out = tr && "output" in tr ? tr.output : undefined;
      trace.push({ tool: call.toolName, input: call.input, resultSize: Array.isArray(out) ? out.length : out ? 1 : 0 });
    }
  }

  const drafts: AgentDraft[] = result.output.drafts.map((d) => {
    const item = partnered.find((p) => p.partner?.name === d.partner);
    if (!allowedPartners.has(d.partner) || !item) {
      const fb = templateDraft(partnered[0], sponsor);
      return { ...fb, checked: "replaced", note: `Agent named "${d.partner}", which is not in the program; replaced with a template.` };
    }
    if (FORBIDDEN.test(`${d.subject} ${d.body}`)) {
      return { ...templateDraft(item, sponsor), checked: "replaced", note: "Draft mentioned a forbidden topic (votes, permits, politics or religion); replaced with a template." };
    }
    return { ...d, checked: "passed" };
  });

  const summaryOk = !FORBIDDEN.test(result.output.summary);
  return {
    model: AGENT_MODEL,
    summary: summaryOk ? result.output.summary : "Summary withheld: it mentioned a forbidden topic.",
    drafts,
    trace,
    steps: result.steps.length,
  };
}
