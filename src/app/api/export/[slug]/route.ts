import { runTown } from "@/lib/run";
import { guardFormula } from "@/lib/ballot";
import { BUCKETS, ROLE_LABEL } from "@/lib/plan";
import { fundParam } from "../../fund";
import { foldLine, icsText } from "../ics";

const csvCell = (v: unknown) => {
  const s = typeof v === "string" ? guardFormula(v) : String(v ?? "");
  return `"${s.replace(/"/g, '""')}"`;
};

// Month 1 of the program is the first month after today.
function monthDate(month: number) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + month, 15, 17));
  return d.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(req.url);
  const run = await runTown(slug, fundParam(url));
  if (!run) return new Response("Unknown town", { status: 404 });
  const format = url.searchParams.get("format") ?? "csv";
  const { town, program } = run;

  if (format === "ics") {
    const events = program.items.flatMap((it) =>
      it.months.map((m, k) =>
        [
          "BEGIN:VEVENT",
          `UID:${town.slug}-${it.id}-${k}@good-neighbor`,
          `DTSTAMP:${monthDate(0)}`,
          `DTSTART:${monthDate(m)}`,
          `SUMMARY:${icsText(it.title)}`,
          `DESCRIPTION:${icsText(`${BUCKETS[it.bucket].label}. Draft date: confirm with the partner. Sponsor-labelled program item.`)}`,
          "END:VEVENT",
        ]
          .map(foldLine)
          .join("\r\n"),
      ),
    );
    const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Good Neighbor//EN", ...events, "END:VCALENDAR"].join("\r\n") + "\r\n";
    return new Response(body, {
      headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${town.slug}-program.ics"` },
    });
  }

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
  rows.push(["Unassigned", "Unassigned, for the committee to allocate", "", "", "", "", "", "", "", "", "", "", "", program.unassigned, "", "", "", ""]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  return new Response(csv, {
    headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${town.slug}-partners.csv"` },
  });
}
