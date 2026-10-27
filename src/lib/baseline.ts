import { z } from "zod";

// The plain-LLM arm: the same model, no Qloo, asked for the plan a consultant would write.
// Shared by the freeze script and the live "regenerate" route so both use the same prompt.

export const BASELINE_PROMPT_VERSION = "baseline-v1";

export const baselineSchema = z.object({
  items: z
    .array(
      z.object({
        item: z.string().describe("One program item, one sentence"),
        partner: z
          .string()
          .nullable()
          .describe("The specific named local organisation, venue or business, or null if none is named"),
      }),
    )
    .min(8)
    .max(12),
});

export type BaselinePlan = z.infer<typeof baselineSchema>;

export function baselinePrompt(town: { name: string; region: string; project: string }) {
  return [
    `You are a community-relations consultant hired by the developer of a ${town.project} in ${town.name}, ${town.region}.`,
    "Write the 24-month community-benefit program you would recommend: 10 to 12 concrete items covering workforce and trades training,",
    "local purchasing, community grants, community events and how to announce the program.",
    "Be as locally specific as you can: name real local venues, businesses, institutions and organisations in or near the town wherever you know them.",
    "If you are not sure a specific local partner exists, leave the partner empty rather than guessing.",
  ].join(" ");
}
