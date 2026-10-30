// Download links for the CRM import CSVs. Server-safe.

import { Download } from "@/components/dashboard/Icons";

export interface CrmExportLinksProps {
  slug: string;
  // Annual fund, passed through so the sheet matches the program on screen.
  fund?: number;
  // Class for each link; defaults to the outlined tool-button style.
  linkClassName?: string;
}

const defaultLink =
  "inline-flex items-center gap-1.5 rounded-btn border border-rule bg-paper px-3 py-1.5 text-sm transition-colors duration-150 hover:border-ink active:bg-concrete";

export function crmExportHref(slug: string, format: "hubspot" | "salesforce", fund?: number) {
  const q = new URLSearchParams({ format });
  if (fund !== undefined) q.set("fund", String(fund));
  return `/api/export/${encodeURIComponent(slug)}?${q}`;
}

export function CrmExportLinks({ slug, fund, linkClassName = defaultLink }: CrmExportLinksProps) {
  return (
    <>
      <a href={crmExportHref(slug, "hubspot", fund)} className={linkClassName} title="Companies import CSV for HubSpot">
        <Download />
        HubSpot (CSV)
      </a>
      <a href={crmExportHref(slug, "salesforce", fund)} className={linkClassName} title="Accounts import CSV for Salesforce">
        <Download />
        Salesforce (CSV)
      </a>
    </>
  );
}
