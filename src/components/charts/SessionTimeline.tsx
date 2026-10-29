import type { SessionRow } from "./chartData";

const MONTHS = Array.from({ length: 24 }, (_, i) => i + 1);

// When each program area meets over the 24-month term: one dot per month with a session; where two
// or more fall in the same month the dot is larger and carries the count. The divider marks year two.
export function SessionTimeline({ rows }: { rows: SessionRow[] }) {
  return (
    <figure className="ch-anim">
      <div className="ch-tl" aria-hidden>
        <div className="ch-tl-axis">
          <span />
          <div>
            <span>Year 1 · months 1–12</span>
            <span>Year 2 · months 13–24</span>
          </div>
          <span>sessions</span>
        </div>
        {rows.map((r) => (
          <div key={r.bucket} className="ch-tl-row">
            <span className="ch-tl-label">
              <span className={`ch-sw ch-k-${r.bucket}`} />
              <span>{r.label}</span>
            </span>
            <span className="ch-tl-months">
              {MONTHS.map((m) => {
                const n = r.months.get(m) ?? 0;
                return (
                  <span key={m} className="ch-tl-m" title={n ? `Month ${m}: ${n}` : undefined}>
                    {n > 0 && <i className={`ch-k-${r.bucket} ${n > 1 ? "is-many" : ""}`}>{n > 1 ? n : null}</i>}
                  </span>
                );
              })}
            </span>
            <span className="ch-tl-count">{r.sessions}</span>
          </div>
        ))}
      </div>
      <div className="sr-only">
        <table>
        <caption>Sessions per program area and month over 24 months</caption>
        <thead>
          <tr>
            <th scope="col">Area</th>
            <th scope="col">Months with a session</th>
            <th scope="col">Sessions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.bucket}>
              <th scope="row">{r.label}</th>
              <td>{[...r.months.entries()].sort((a, b) => a[0] - b[0]).map(([m, n]) => (n > 1 ? `${m} (${n})` : String(m))).join(", ")}</td>
              <td>{r.sessions}</td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </figure>
  );
}
