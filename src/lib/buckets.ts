export type Bucket = "training" | "procurement" | "grants" | "events" | "channels";

// `cadence` is the fallback label; the program computes the real one from its scheduled months.
export const BUCKETS: Record<Bucket, { label: string; cadence: string }> = {
  training: { label: "Trades & training nights", cadence: "Quarterly" },
  procurement: { label: "Local purchasing", cadence: "Quarterly" },
  grants: { label: "Community fund grants", cadence: "Once a year" },
  events: { label: "Community events", cadence: "Once a year" },
  channels: { label: "Where to announce it", cadence: "At launch, then month 13" },
};
