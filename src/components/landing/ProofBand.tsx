import Link from "next/link";
import { Chevron } from "./Chevron";

export interface ProofArm {
  pct?: number;
  na?: string; // shown instead of a bar when this comparison does not measure this side
}

export interface ProofRow {
  measure: string;
  note: string;
  llm: ProofArm;
  gn: ProofArm;
}

const ARMS = [
  { key: "llm", who: "Plain LLM" },
  { key: "gn", who: "Good Neighbor" },
] as const;

// Head-to-head rows from /proof: the plain LLM and Good Neighbor on the same 0-100 scale.
export function ProofBand({ rows, townCount }: { rows: ProofRow[]; townCount: string }) {
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

        <ol className="lp-h2h">
          {rows.map((r) => (
            <li key={r.measure} className="lp-h2h-row">
              <div className="lp-h2h-measure">
                <h3 className="lp-h3">{r.measure}</h3>
                <p>{r.note}</p>
              </div>
              <div className="lp-h2h-lines">
                {ARMS.map(({ key, who }) => {
                  const arm = r[key];
                  return (
                    <div key={key} className={`lp-h2h-line is-${key}`}>
                      <span className="lp-h2h-who">{who}</span>
                      {arm.pct != null ? (
                        <>
                          <span className="lp-h2h-track" aria-hidden="true">
                            <span className="lp-h2h-fill" style={{ width: `${arm.pct}%` }} />
                          </span>
                          <span className="lp-h2h-val">{arm.pct}%</span>
                        </>
                      ) : (
                        <span className="lp-h2h-na">
                          <span aria-hidden="true">—</span> {arm.na}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>

        <p className="lp-proof-foot">
          Verified means found on Qloo or OpenStreetMap within 25 km; unverified is not proof of invented. Institutions
          are good partners too, and a partner’s willingness is not confirmed. Six towns, one model: a directional check,
          not a statistical study, and it does not show that residents prefer the program.{" "}
          <Link href="/proof" className="lp-textlink">
            Read the method and the per-town table <Chevron />
          </Link>
        </p>
      </div>
    </section>
  );
}
