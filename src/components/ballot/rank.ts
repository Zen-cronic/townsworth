// Ballot positions as the tally draws them; the guided path's preview uses the same ramp.

export const ordinal = (n: number) =>
  `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;

// Four clear steps, darkest = ranked first: ink, about 60% and 30% ink, then an outline for last.
// Longer shortlists spread the tints between. Pink stays the strike.
const shade = (r: number, n: number) => (r === 0 ? 100 : Math.round(60 - ((r - 1) / Math.max(n - 3, 1)) * 30));
export const isLast = (r: number, n: number) => n > 1 && r === n - 1;
export const rankFill = (r: number, n: number) => (isLast(r, n) ? "var(--paper)" : `color-mix(in srgb, var(--ink) ${shade(r, n)}%, var(--paper))`);
export const rankInk = (r: number, n: number) => (r === 0 || (!isLast(r, n) && shade(r, n) >= 55) ? "var(--paper)" : "var(--ink)");
