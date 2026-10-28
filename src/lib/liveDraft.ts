import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { unstable_cache } from "next/cache";
import { headers } from "next/headers";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import type { BaselineItem } from "./baselineData";
import { BASELINE_PROMPT_VERSION, baselinePrompt, baselineSchema } from "./baseline";
import { osmLookup } from "./nominatim";
import { clientIp, takeSlot } from "./rateLimit";
import { townBySlug, type Town } from "./towns";

// The plain-LLM arm, run live for a town the user typed in. Same prompt, schema and model as the
// frozen baseline, and the same OpenStreetMap check per named partner. It is never part of /proof.

export const LIVE_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const WEEK = 60 * 60 * 24 * 7;

const PROMPT_PROJECT: Record<string, string> = {
  "data center": "data center project",
  fab: "semiconductor fab project",
  nuclear: "nuclear plant project",
  plant: "manufacturing plant project",
};

interface RawDraft {
  items: { item: string; partner: string | null }[];
  model: string;
  ms: number;
}

export interface LiveDraft {
  items: BaselineItem[];
  model: string;
  promptVersion: string;
  createdAt: string;
  llmMs: number;
  osmMs: number;
  osmFailures: number;
}

// The client IP for the request that starts a fresh draft. The cached functions below can't read
// request headers, so the uncached wrapper passes the IP through async context.
const requestIp = new AsyncLocalStorage<string>();

// The LLM call is cached on its own, keyed by what the prompt uses (name, region, facility), so a
// failed OSM pass can retry without paying for a new draft and the company segment doesn't re-bill.
const draftPlan = unstable_cache(
  async (name: string, region: string, facility: Town["facility"]): Promise<RawDraft> => {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is not set");
    // Only a cache miss reaches here, so only a fresh draft counts against the limit.
    const slot = takeSlot("live-draft", requestIp.getStore() ?? "unknown");
    if (!slot.ok) throw new Error("too many live drafts from your network right now; try again in a few minutes");
    const started = Date.now();
    const { output } = await generateText({
      model: createOpenAI({ apiKey: key })(LIVE_MODEL),
      output: Output.object({ schema: baselineSchema }),
      prompt: baselinePrompt({ name, region, project: PROMPT_PROJECT[facility] }),
      abortSignal: AbortSignal.timeout(35_000),
    });
    return { items: output.items, model: LIVE_MODEL, ms: Date.now() - started };
  },
  ["live-llm-draft", BASELINE_PROMPT_VERSION],
  { revalidate: WEEK },
);

// Thrown inside the cache so a pass with an OpenStreetMap failure is returned but never stored.
class Uncacheable extends Error {
  constructor(readonly draft: LiveDraft) {
    super("uncacheable live draft");
  }
}

// The OSM pass also needs the coordinates, so they join the key here.
const verifiedDraft = unstable_cache(
  async (name: string, region: string, facility: Town["facility"], lat: number, lon: number): Promise<LiveDraft> => {
    const draft = await draftPlan(name, region, facility);
    const started = Date.now();
    const items: BaselineItem[] = [];
    for (const it of draft.items) {
      items.push({ ...it, osm: it.partner ? await osmLookup(it.partner, { lat, lon }) : null });
    }
    const checked = items.filter((i) => i.osm);
    const osmFailures = checked.filter((i) => i.osm!.status !== 200).length;
    // When OpenStreetMap mostly didn't answer, the audit would under-count real partners.
    if (checked.length && osmFailures > checked.length / 2) throw new Error("OpenStreetMap check unavailable");
    const result: LiveDraft = {
      items,
      model: draft.model,
      promptVersion: BASELINE_PROMPT_VERSION,
      createdAt: new Date().toISOString(),
      llmMs: draft.ms,
      osmMs: Date.now() - started,
      osmFailures,
    };
    if (osmFailures) throw new Uncacheable(result);
    return result;
  },
  ["live-llm-draft-verified", BASELINE_PROMPT_VERSION],
  { revalidate: WEEK },
);

export async function liveLlmDraft(slug: string): Promise<LiveDraft> {
  const town = townBySlug(slug);
  if (!town) throw new Error("unknown town");
  const ip = clientIp(await headers());
  try {
    return await requestIp.run(ip, () => verifiedDraft(town.name, town.region, town.facility, town.lat, town.lon));
  } catch (e) {
    if (e instanceof Uncacheable) return e.draft;
    throw e;
  }
}
