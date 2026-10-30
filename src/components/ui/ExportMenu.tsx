import { Chevron, Download } from "@/components/dashboard/Icons";
import { secondaryCta } from "@/components/dashboard/ui";

// One "Export" disclosure holding every download; each child is a row styled with EXPORT_ITEM.
export const EXPORT_ITEM = "gn-menu-item";

export function ExportMenu({ children, align = "start" }: { children: React.ReactNode; align?: "start" | "end" }) {
  return (
    <details className={`gn-menu ${align === "end" ? "is-end" : ""}`}>
      <summary className={secondaryCta}>
        <Download />
        Export
        <Chevron className="chev h-3 w-3" />
      </summary>
      <div className="gn-menu-list">{children}</div>
    </details>
  );
}
