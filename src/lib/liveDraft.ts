import "server-only";
import { unstable_cache } from "next/cache";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import type { BaselineItem } from "./baselineData";
import { BASELINE_PROMPT_VERSION, baselinePrompt, baselineSchema } from "./baseline";
import { osmLookup } from "./nominatim";
import { townBySlug } from "./towns";

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

// The LLM call is cached on its own, so a failed OSM pass can retry without paying for a new draft.
const draftPlan = unstable_cache(
  async (slug: string): Promise<RawDraft> => {
    const town = townBySlug(slug);
    if (!town) throw new Error("unknown town");
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is not set");
    const started = Date.now();
    const { output } = await generateText({
      model: createOpenAI({ apiKey: key })(LIVE_MODEL),
      output: Output.object({ schema: baselineSchema }),
      prompt: baselinePrompt({ name: town.name, region: town.region, project: PROMPT_PROJECT[town.facility] }),
      abortSignal: AbortSignal.timeout(35_000),
    });
    return { items: output.items, model: LIVE_MODEL, ms: Date.now() - started };
  },
  ["live-llm-draft", BASELINE_PROMPT_VERSION],
  { revalidate: WEEK },
);

export const liveLlmDraft = unstable_cache(
  async (slug: string): Promise<LiveDraft> => {
    const town = townBySlug(slug);
    if (!town) throw new Error("unknown town");
    const draft = await draftPlan(slug);
    const started = Date.now();
    const items: BaselineItem[] = [];
    for (const it of draft.items) {
      items.push({ ...it, osm: it.partner ? await osmLookup(it.partner, town) : null });
    }
    const checked = items.filter((i) => i.osm);
    const osmFailures = checked.filter((i) => i.osm!.status !== 200).length;
    // Don't cache a pass where OpenStreetMap mostly didn't answer; it would under-count real partners.
    if (checked.length && osmFailures > checked.length / 2) throw new Error("OpenStreetMap check unavailable");
    return {
      items,
      model: draft.model,
      promptVersion: BASELINE_PROMPT_VERSION,
      createdAt: new Date().toISOString(),
      llmMs: draft.ms,
      osmMs: Date.now() - started,
      osmFailures,
    };
  },
  ["live-llm-draft-verified", BASELINE_PROMPT_VERSION],
  { revalidate: WEEK },
);
