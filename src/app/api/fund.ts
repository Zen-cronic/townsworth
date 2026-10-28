import { parseFund } from "@/components/dashboard/ui";

export const MAX_FUND = 1e9;

// The `fund` query parameter as a positive whole number, capped at MAX_FUND; undefined means the town default.
export function fundParam(url: URL): number | undefined {
  const n = parseFund(url.searchParams.get("fund") ?? undefined);
  return n === undefined ? undefined : Math.min(n, MAX_FUND);
}
