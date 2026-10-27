import Link from "next/link";
import { Chevron } from "./Chevron";

export type Side = "llm" | "gn";

export interface ProofBar {
  label: string;
  pct: number;
  side: Side;
}

export interface ProofFigure {
  value: string;
  side: Side;
  label: string;
  bars: ProofBar[];
  caveat: string;
}

const SIDE_LABEL: Record<Side, string> = { llm: "Plain LLM", gn: "Good Neighbor" };

// The headline numbers from /proof, one format per figure, each with the line that keeps it honest.
export function ProofBand({ figures, townCount }: { figures: ProofFigure[]; townCount: string }) {
  return (
    <section className="lp-section lp-proof" aria-labelledby="proof-h">
      <div className="lp-wrap">
        <div className="lp-section-head">
          <div>
            <p className="lp-kicker">Proof · recomputed on every load</p>
            <h2 id="proof-h" className="lp-h2">
              Would a plain LLM write the same plan? We checked.
            </h2>
          </div>
          <p className="lp-section-lede">
            For each of the {townCount} host towns, a model with no Qloo access wrote the plan a consultant would, frozen
            before we measured. Then we compared it with what Good Neighbor proposes.
          </p>
        </div>

        <p className="lp-legend">
          <span className="is-llm">Plain LLM, no Qloo</span>
          <span className="is-gn">Good Neighbor, with Qloo</span>
        </p>
        <ul className="lp-figures">
          {figures.map((f) => (
            <li key={f.label} className={`lp-figure is-${f.side}`}>
              <p className="lp-figure-side">{SIDE_LABEL[f.side]}</p>
              <p className="lp-figure-value">{f.value}</p>
              <p className="lp-figure-label">{f.label}</p>
              <div className="lp-bars">
                {f.bars.map((b) => (
                  <div key={b.label} className={`lp-bar is-${b.side}`}>
                    <span className="lp-bar-label">{b.label}</span>
                    <span className="lp-bar-track" aria-hidden="true">
                      <span className="lp-bar-fill" style={{ width: `${b.pct}%` }} />
                    </span>
                    <span className="lp-bar-pct">{b.pct}%</span>
                  </div>
                ))}
              </div>
              <p className="lp-figure-caveat">{f.caveat}</p>
            </li>
          ))}
        </ul>

        <p className="lp-proof-foot">
          Six towns, one model: a directional check, not a statistical study. It does not show that residents prefer
          the program.{" "}
          <Link href="/proof" className="lp-textlink">
            Read the method and the per-town table <Chevron />
          </Link>
        </p>
      </div>
    </section>
  );
}
