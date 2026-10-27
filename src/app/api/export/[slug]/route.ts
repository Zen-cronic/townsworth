import { runTown } from "@/lib/run";
import { BUCKETS } from "@/lib/plan";

const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

// Month 1 of the program is the first month after today.
function monthDate(month: number) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + month, 15, 17));
  return d.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(req.url);
  const run = await runTown(slug, Number(url.searchParams.get("fund")) || undefined);
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
          `SUMMARY:${it.title.replace(/[,;]/g, " ")}`,
          `DESCRIPTION:${BUCKETS[it.bucket].label}. Draft date: confirm with the partner. Sponsor-labelled program item.`,
          "END:VEVENT",
        ].join("\r\n"),
      ),
    );
    const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Good Neighbor//EN", ...events, "END:VCALENDAR"].join("\r\n");
    return new Response(body, {
      headers: { "Content-Type": "text/calendar", "Content-Disposition": `attachment; filename="${town.slug}-program.ics"` },
    });
  }

  const header = ["bucket", "item", "partner", "address", "distance_km", "phone", "website", "event_space", "amount_usd", "months", "qloo_signal", "signal_detail"];
  const rows = program.items.map((it) => [
    BUCKETS[it.bucket].label,
    it.title,
    it.partner?.name,
    it.partner?.address,
    it.partner?.distanceKm,
    it.partner?.phone,
    it.partner?.website,
    it.partner?.eventSpaces ? "yes" : "",
    it.amount,
    it.months.join(" "),
    it.provenance[0]?.signal,
    it.provenance[0]?.detail,
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  return new Response(csv, {
    headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${town.slug}-partners.csv"` },
  });
}
