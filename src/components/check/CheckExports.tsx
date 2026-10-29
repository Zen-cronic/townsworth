"use client";

import type { CheckResult } from "@/lib/userPlan";
import { Download } from "@/components/dashboard/Icons";
import { PrintButton } from "@/components/dashboard/PrintButton";
import { downloadExport, type ExportKind } from "./exportCheck";

// Downloads and print for a checked draft. Files are generated in the browser from the result.

const BUTTON =
  "inline-flex items-center gap-1.5 rounded-md border border-rule bg-paper px-2.5 py-1.5 text-sm transition-colors duration-150 hover:border-ink active:bg-concrete";

const FILES: { kind: ExportKind; label: string; title: string }[] = [
  { kind: "audit", label: "Audit (CSV)", title: "Every draft line with its verdict, reason and the Qloo item that replaces or joins it" },
  { kind: "program", label: "Program (CSV)", title: "The costed program, item by item" },
  { kind: "ics", label: "Calendar (.ics)", title: "One event per scheduled session" },
  { kind: "hubspot", label: "HubSpot (CSV)", title: "Companies import CSV for HubSpot" },
  { kind: "salesforce", label: "Salesforce (CSV)", title: "Accounts import CSV for Salesforce" },
];

export function CheckExports({ result }: { result: CheckResult }) {
  return (
    <div className="no-print flex max-w-md flex-col gap-2 sm:items-end">
      <p className="text-xs text-muted">Download this check (made in your browser)</p>
      <div className="flex flex-wrap gap-1.5 sm:justify-end">
        {FILES.map((f) => (
          <button key={f.kind} type="button" title={f.title} onClick={() => downloadExport(f.kind, result)} className={BUTTON}>
            <Download />
            {f.label}
          </button>
        ))}
        <PrintButton className={BUTTON} />
      </div>
    </div>
  );
}
