import "server-only";
import { commitmentsFor, type Commitment } from "@/lib/commitments";

export interface Spec {
  topic: string;
  value: string;
  unit: string;
  note: string;
  source: string;
  url: string;
}

// The headline figures for the example town, each tied to the cited commitment it comes from.
// A figure whose source line can't be found is dropped, never shown unsourced.
const PICKS: { topic: Commitment["topic"]; match: RegExp; value: string; unit: string; note: string }[] = [
  { topic: "Jobs", match: /2,000 jobs/, value: "2,000", unit: "jobs", note: "expected at full build, Microsoft says" },
  { topic: "Power", match: /100% of the costs/, value: "100%", unit: "of new generation", note: "paid by loads of 100 MW or more (PSC, preliminary)" },
  { topic: "Water", match: /702,000 gallons a day/, value: "702,000", unit: "gal/day", note: "peak use at full buildout, from city records" },
  { topic: "Tax", match: /\$1\.4 billion/, value: "$1.4B", unit: "minimum value", note: "assessed by Jan. 1, 2028, with no public incentives" },
];

export function specsFor(slug: string): { asOf: string; specs: Spec[] } | null {
  const c = commitmentsFor(slug);
  if (!c) return null;
  const specs = PICKS.flatMap((p) => {
    const hit = c.items.find((it) => it.topic === p.topic && p.match.test(it.text));
    return hit ? [{ topic: p.topic, value: p.value, unit: p.unit, note: p.note, source: hit.source.split(" — ")[0], url: hit.url }] : [];
  });
  return specs.length ? { asOf: c.asOf, specs } : null;
}
