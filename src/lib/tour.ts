// The product tour (/judges) opens each step's live page with `?tour=N`, so that page can offer a
// way back to the tour and on to the next step. Without the parameter every page is unchanged.

export interface TourStop {
  title: string;
  href: string;
}

// Adds `tour=N` to a same-site link, before any #fragment, keeping its other parameters.
export function withTour(href: string, step: number): string {
  const hashAt = href.indexOf("#");
  const path = hashAt < 0 ? href : href.slice(0, hashAt);
  const hash = hashAt < 0 ? "" : href.slice(hashAt);
  const [base, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("tour", String(step));
  return `${base}?${params}${hash}`;
}

// A step number from `?tour=`, or null when it is missing or not a step of a tour this long.
export function tourStep(value: string | null | undefined, steps: number): number | null {
  if (!value || !/^\d{1,2}$/.test(value)) return null;
  const n = Number(value);
  return n >= 1 && n <= steps ? n : null;
}

// Where "Next" goes from step N: the next stop's own page, or back to the tour's optional extra
// after the last step. When the stops are unknown (the page was opened straight from a tour link),
// the next step's place in the tour.
export function nextStop(step: number, stops: TourStop[] | null, total: number): { href: string; label: string } {
  if (step >= total) return { href: "/judges#own-plan", label: "Check a plan of your own" };
  const next = stops?.[step];
  if (next) return { href: withTour(next.href, step + 1), label: next.title };
  return { href: `/judges#step-${step + 1}`, label: `Step ${step + 1}` };
}
