// Shared class strings. Pink is the strike only; actions are ink.
// The three button styles (see .btn in globals.css): one solid primary per view, outlined
// secondaries, and underlined tertiary text actions.
export const primaryCta = "btn btn-primary";
export const secondaryCta = "btn btn-secondary";
export const tertiaryCta = "btn btn-tertiary";

// "2,000,000" or "$2,000,000" from a form field -> 2000000; anything else -> undefined.
export function parseFund(raw?: string): number | undefined {
  const n = Number((raw ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}
