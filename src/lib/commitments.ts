import "server-only";
import raw from "../../data/commitments.json";

// Material commitments (jobs, power, water, noise, tax) from cited public reporting, per town.
// Bundled at build time; any entry that doesn't match the schema is ignored, never guessed at.

export type CommitmentTopic = "Jobs" | "Power" | "Water" | "Noise & light" | "Tax";

export interface Commitment {
  topic: CommitmentTopic;
  text: string;
  source: string;
  url: string;
}

export interface TownCommitments {
  asOf: string;
  items: Commitment[];
}

const TOPICS = new Set<string>(["Jobs", "Power", "Water", "Noise & light", "Tax"]);

function valid(c: unknown): c is Commitment {
  if (!c || typeof c !== "object") return false;
  const x = c as Record<string, unknown>;
  return (
    typeof x.topic === "string" &&
    TOPICS.has(x.topic) &&
    typeof x.text === "string" &&
    x.text.trim().length > 0 &&
    typeof x.source === "string" &&
    typeof x.url === "string" &&
    /^https:\/\//.test(x.url)
  );
}

export function commitmentsFor(slug: string): TownCommitments | null {
  const entry = (raw as Record<string, unknown>)[slug];
  if (!entry || typeof entry !== "object") return null;
  const { asOf, items } = entry as { asOf?: unknown; items?: unknown };
  const list = Array.isArray(items) ? items.filter(valid) : [];
  if (!list.length || typeof asOf !== "string") return null;
  return { asOf, items: list };
}
