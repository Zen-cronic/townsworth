// Browser-side exports for a checked draft. Everything is built from the check result already on
// the page and handed to the browser as a Blob download; nothing is sent back to the server.

import { programIcs } from "@/app/api/export/ics";
import { hubspotCsv, salesforceCsv, toCsv } from "@/lib/integrations";
import { BUCKETS, ROLE_LABEL } from "@/lib/plan";
import type { CheckResult } from "@/lib/userPlan";

const VERDICT_LABEL = {
  grounded: "Kept",
  institution: "Kept (institution, couldn't verify here)",
  mechanism: "Kept (grant mechanism)",
  generic: "Not local",
  unverified: "Can't confirm",
} as const;

// The town slug, reduced to characters every file system accepts.
export const fileStem = (slug: string) => slug.replace(/[^A-Za-z0-9._-]+/g, "_");

// One row per draft line: the verdict, the reason, and the Qloo item that replaces or joins it.
export function auditCsv(result: CheckResult): string {
  const header = ["line", "draft_item", "verdict", "reason", "named_partner", "good_neighbor_item", "role", "good_neighbor_partner", "amount_usd", "qloo_signal"];
  const rows = result.audit.map((a, i) => {
    const swap = a.replacement ?? a.alongside;
    const role = a.replacement ? "replaces this line" : a.alongside ? "added alongside" : a.applicants?.length ? "suggested applicants" : "";
    return [
      i + 1,
      a.text,
      VERDICT_LABEL[a.verdict],
      a.reasons[0] ?? "",
      a.named ?? "",
      swap?.title ?? "",
      role,
      swap?.partner?.name ?? (a.applicants ?? []).map((p) => p.partner?.name).filter(Boolean).join("; "),
      swap?.amount ?? "",
      swap?.provenance[0]?.signal ?? "",
    ];
  });
  return toCsv([header, ...rows]);
}

// Same columns as /api/export/{slug}, so the sheet opens in the same template.
export function programCsv(result: CheckResult): string {
  const header = [
    "bucket", "item", "partner", "partner_role", "run_with", "address", "distance_km", "neighbouring_community", "phone", "website", "event_space",
    "sessions", "unit_cost_usd", "amount_usd", "months", "cadence", "qloo_signal", "signal_detail",
  ];
  const rows: unknown[][] = result.program.items.map((it) => [
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
  rows.push(["Unassigned", "Unassigned, for the committee to allocate", "", "", "", "", "", "", "", "", "", "", "", result.program.unassigned, "", "", "", ""]);
  return toCsv([header, ...rows]);
}

export type ExportKind = "audit" | "program" | "ics" | "hubspot" | "salesforce";

export function buildExport(kind: ExportKind, result: CheckResult, now: Date = new Date()): { filename: string; type: string; body: string } {
  const stem = `${fileStem(result.town.slug)}-your-draft`;
  const csv = "text/csv;charset=utf-8";
  switch (kind) {
    case "audit":
      return { filename: `${stem}-audit.csv`, type: csv, body: auditCsv(result) };
    case "program":
      return { filename: `${stem}-program.csv`, type: csv, body: programCsv(result) };
    case "ics":
      return { filename: `${stem}-program.ics`, type: "text/calendar;charset=utf-8", body: programIcs(fileStem(result.town.slug), result.program.items, now) };
    case "hubspot":
      return { filename: `${stem}-partners-hubspot.csv`, type: csv, body: hubspotCsv(result.program.items, result.town) };
    case "salesforce":
      return { filename: `${stem}-partners-salesforce.csv`, type: csv, body: salesforceCsv(result.program.items, result.town) };
  }
}

export function downloadExport(kind: ExportKind, result: CheckResult) {
  const { filename, type, body } = buildExport(kind, result);
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
