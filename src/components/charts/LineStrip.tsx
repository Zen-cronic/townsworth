import type { LineComposition, LineState } from "./chartData";

const WORD: Record<LineState, string> = { kept: "kept", generic: "struck, not local", unverified: "struck, can't confirm" };

// One cell per draft line in draft order: green kept, pink struck (hatched pink when the partner
// couldn't be confirmed). Each cell links to its line when `anchorOf` is set. A legend with counts
// sits below, so colour is never the only key.
export function LineStrip({
  comp,
  anchorOf,
  size = "md",
  legend = true,
}: {
  comp: LineComposition;
  // The fragment id a line's cell links to (a collapsed group of lines shares one anchor).
  anchorOf?: (index: number) => string;
  size?: "md" | "sm";
  legend?: boolean;
}) {
  const numbers = comp.total <= 24;
  const struck = comp.generic + comp.unverified;
  return (
    <div className="ch-anim">
      <ol className={`ch-strip ${size === "sm" ? "is-sm" : ""}`} aria-label={`${comp.total} draft lines: ${comp.kept} kept, ${comp.generic} not local, ${comp.unverified} can't confirm`}>
        {comp.lines.map((s, i) => {
          const cell = (
            <>
              <span className={`ch-cell ch-k-${s}`} aria-hidden />
              {numbers && size === "md" && (
                <span className="ch-cell-n" aria-hidden>
                  {i + 1}
                </span>
              )}
              <span className="sr-only">
                Line {i + 1}: {WORD[s]}
              </span>
            </>
          );
          return (
            <li key={i}>
              {anchorOf ? (
                <a href={`#${anchorOf(i)}`} className="grid gap-1 rounded-[3px]">
                  {cell}
                </a>
              ) : (
                cell
              )}
            </li>
          );
        })}
      </ol>
      {legend && (
        <ul className="ch-legend mt-3" aria-hidden>
          <li>
            <span className="ch-sw ch-k-kept" />
            <b>{comp.kept}</b> kept
          </li>
          {comp.generic > 0 && (
            <li>
              <span className="ch-sw ch-k-generic" />
              <b>{comp.generic}</b> not local
            </li>
          )}
          {comp.unverified > 0 && (
            <li>
              <span className="ch-sw ch-k-unverified" />
              <b>{comp.unverified}</b> can&apos;t confirm
            </li>
          )}
          {struck === 0 && <li>none struck</li>}
        </ul>
      )}
    </div>
  );
}
