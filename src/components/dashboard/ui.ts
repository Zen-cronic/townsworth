// Shared class strings. Pink is the strike only; actions are ink.
export const primaryCta =
  "inline-flex items-center gap-1.5 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-paper transition-colors duration-150 hover:bg-ink/85 active:bg-ink/75";

export const secondaryCta =
  "inline-flex items-center gap-1.5 rounded-md border border-rule bg-paper px-3 py-1.5 text-sm font-medium transition-colors duration-150 hover:border-ink active:bg-concrete";

// "2,000,000" or "$2,000,000" from a form field -> 2000000; anything else -> undefined.
export function parseFund(raw?: string): number | undefined {
  const n = Number((raw ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}
