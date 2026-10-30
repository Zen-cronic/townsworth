import { Figure } from "@/components/dashboard/Figure";
import type { LineComposition } from "./chartData";
import { LineStrip } from "./LineStrip";

// The one summary of a checked draft, used wherever a page reports it: which draft, how many of
// its lines were struck, how many kept, and one cell per line. Same weight, same "of N" ratio and
// the same cell strip on every page.
export function StruckTally({ comp, draft, anchorOf }: { comp: LineComposition; draft: string; anchorOf?: (index: number) => string }) {
  const struck = comp.generic + comp.unverified;
  return (
    <div className="tally">
      <p className="tally-draft">{draft}</p>
      <p className={`tally-v ${struck ? "is-pen" : "is-ok"}`}>
        <Figure value={`${struck} of ${comp.total}`} />
      </p>
      <p className="tally-k">
        {struck === 1 ? "draft line struck" : "draft lines struck"} · {comp.kept} kept
      </p>
      {comp.total > 0 && <LineStrip comp={comp} anchorOf={anchorOf} size="sm" legend={false} />}
    </div>
  );
}
