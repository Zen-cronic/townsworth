import type { ProgramItem } from "@/lib/plan";
import { Chevron } from "./Icons";

// The Qloo signal behind a proposal, one click away.
export function ProvenanceChip({ item }: { item: ProgramItem }) {
  return (
    <details className="group text-xs">
      <summary className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-hairline bg-concrete px-2 py-1 text-muted transition-colors duration-150 hover:border-rule hover:text-ink">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ink" />
        <span className="font-mono">{item.provenance[0]?.signal ?? "Qloo signal"}</span>
        <span className="text-muted/80">Why</span>
        <Chevron className="chev h-3 w-3" />
      </summary>
      <ul className="mt-2 space-y-1 border-l border-rule pl-3 leading-relaxed text-muted">
        {item.provenance.map((p, i) => (
          <li key={i}>
            <span className="font-mono text-ink">{p.signal}</span>: {p.detail}
          </li>
        ))}
      </ul>
    </details>
  );
}
