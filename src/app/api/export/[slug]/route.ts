import { runTown } from "@/lib/run";
import { BUCKETS, ROLE_LABEL } from "@/lib/plan";
import { hubspotCsv, salesforceCsv, toCsv } from "@/lib/integrations";
import { fundParam } from "../../fund";
import { programIcs } from "../ics";

const csvResponse = (csv: string, filename: string) =>
  new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` } });

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(req.url);
  const run = await runTown(slug, fundParam(url));
  if (!run) return new Response("Unknown town", { status: 404 });
  const format = url.searchParams.get("format") ?? "csv";
  const { town, program } = run;

  if (format === "ics") {
    const body = programIcs(town.slug, program.items);
    return new Response(body, {
      headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${town.slug}-program.ics"` },
    });
  }

  if (format === "hubspot") return csvResponse(hubspotCsv(program.items, town), `${town.slug}-partners-hubspot.csv`);
  if (format === "salesforce") return csvResponse(salesforceCsv(program.items, town), `${town.slug}-partners-salesforce.csv`);

  const header = [
    "bucket", "item", "partner", "partner_role", "run_with", "address", "distance_km", "neighbouring_community", "phone", "website", "event_space",
    "sessions", "unit_cost_usd", "amount_usd", "months", "cadence", "qloo_signal", "signal_detail",
  ];
  const rows = program.items.map((it) => [
    BUCKETS[it.bucket].label,
    it.title,
    it.partner?.name,
    it.role ? ROLE_LABEL[it.role] : "",
    it.runWith,
    it.partner?.address,
    it.partner?.distanceKm,
    it.partner?.neighbouring ? "yes" : "",
    it.partner?.phone,
    it.partner?.website,
    it.partner?.eventSpaces ? "yes" : "",
    it.sessions,
    it.unitCost,
    it.amount,
    it.months.join(" "),
    it.cadence,
    it.provenance[0]?.signal,
    it.provenance[0]?.detail,
  ]);
  // The unassigned remainder is a line of its own, so the sheet reconciles with the fund.
  rows.push(["Reserve", "Reserve, for the committee to allocate", "", "", "", "", "", "", "", "", "", "", "", program.unassigned, "", "", "", ""]);
  const csv = toCsv([header, ...rows]);
  return new Response(csv, {
    headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${town.slug}-partners.csv"` },
  });
}
