import { isKept, type AuditRow, type KeptAs } from "@/lib/audit";

// Why each kept line was kept, counted once per line. The parts always sum to the kept total.

const ORDER: KeptAs[] = ["partner", "institution", "signal", "host", "mechanism", "in-kind"];

const LABEL: Record<KeptAs, [string, string]> = {
  partner: ["verified local partner", "verified local partners"],
  institution: ["institution to confirm", "institutions to confirm"],
  signal: ["match to a local favourite", "matches to local favourites"],
  host: ["line naming the host community", "lines naming the host community"],
  mechanism: ["commitment kept as drafted", "commitments kept as drafted"],
  "in-kind": ["in-kind item (not costed)", "in-kind items (not costed)"],
};

// The category of a kept line. Rows without `keptAs` fall back on the verdict.
function categoryOf(row: AuditRow): KeptAs {
  if (row.keptAs) return row.keptAs;
  if (row.verdict === "institution") return "institution";
  if (row.verdict === "mechanism") return "mechanism";
  return row.matched ? "partner" : "signal";
}

export interface KeptBreakdown {
  total: number;
  counts: Record<KeptAs, number>;
  // Non-zero categories in display order, e.g. "5 verified local partners".
  parts: string[];
}

export function keptBreakdown(audit: AuditRow[]): KeptBreakdown {
  const counts = Object.fromEntries(ORDER.map((k) => [k, 0])) as Record<KeptAs, number>;
  const kept = audit.filter((r) => isKept(r.verdict));
  for (const row of kept) counts[categoryOf(row)]++;
  const sum = ORDER.reduce((s, k) => s + counts[k], 0);
  if (sum !== kept.length) throw new Error(`keptBreakdown: categories sum to ${sum}, expected ${kept.length} kept lines`);
  const parts = ORDER.filter((k) => counts[k] > 0).map((k) => `${counts[k]} ${LABEL[k][counts[k] === 1 ? 0 : 1]}`);
  return { total: kept.length, counts, parts };
}
