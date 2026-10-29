import Link from "next/link";
import { LiveDataNotice } from "@/components/LiveDataNotice";
import { PRODUCT_NAME } from "./brand";
import { Chevron } from "./Chevron";

export interface ProofStat {
  pct: number;
  // Which side the figure measures; only the product's own figures take the green.
  arm: "llm" | "gn";
  label: string;
  note: string;
}

// The evidence, in one finding: the paired comparison where both sides are measured, then the
// one-sided measures as figures of their own.
export function ProofBand({
  paired,
  stats,
  townCount,
  failedTowns = [],
}: {
  paired: { measure: string; note: string; llm: number; gn: number };
  stats: ProofStat[];
  townCount: string;
  failedTowns?: string[];
}) {
  const arms = [
    { key: "llm", who: "AI alone", pct: paired.llm },
    { key: "gn", who: PRODUCT_NAME, pct: paired.gn },
  ] as const;
  return (
    <>
      <div className="lp-section-head">
        <div className="lp-proof-title">
          <p className="lp-kicker">Would AI alone write the same plan? We tested it.</p>
          <h2 id="proof-h" className="lp-h2 lp-proof-h">
            <span className="lp-fill">AI alone names the institutions.</span>{" "}
            <span className="lp-tone">Qloo adds the places the town actually goes.</span>
          </h2>
        </div>
        <p className="lp-section-lede">
          AI alone against {PRODUCT_NAME} in {townCount} host towns, with plans frozen before we measured.
        </p>
        <LiveDataNotice towns={failedTowns} />
      </div>

      <div className="lp-pair">
        <div className="lp-h2h-measure">
          <h3 className="lp-h3">{paired.measure}</h3>
          <p>{paired.note}</p>
        </div>
        <div className="lp-h2h-lines">
          {arms.map((a) => (
            <div key={a.key} className={`lp-h2h-line is-${a.key}`}>
              <span className="lp-h2h-who">{a.who}</span>
              <span className="lp-h2h-track" aria-hidden="true">
                <span className="lp-h2h-fill" style={{ width: `${a.pct}%` }} />
              </span>
              <span className="lp-h2h-val">{a.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      <ul className="lp-stats">
        {stats.map((s) => (
          <li key={s.label} className={`is-${s.arm}`}>
            <p className="lp-stat-v">{s.pct}%</p>
            <p className="lp-stat-k">{s.label}</p>
            <p className="lp-stat-note">{s.note}</p>
          </li>
        ))}
      </ul>

      <p className="lp-proof-foot">
        A directional check, not a study; unverified is not proof of invented.{" "}
        <Link href="/proof#limits" className="lp-textlink">
          Method and limits <Chevron />
        </Link>
      </p>
    </>
  );
}
