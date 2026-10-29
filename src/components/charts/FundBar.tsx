import type { FundPart } from "./chartData";

// Whole percent, with a sliver shown as "<1%" rather than a misleading 0%.
const share = (p: FundPart) => (p.amount > 0 && p.pct < 1 ? "<1%" : `${p.pct}%`);

const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

// Segments that can carry an inside label at AA contrast: paper on green or asphalt, ink on pale concrete.
const DARK = new Set<FundPart["key"]>(["training", "grants"]);
const LABELLED = new Set<FundPart["key"]>(["training", "grants", "channels"]);

// The 24-month fund as one stacked bar: program areas, then the reserve (hatched). A segment shows
// its share inside only when it is wide enough to hold the label; every value is in the legend and
// the hidden table.
export function FundBar({ parts, total, size = "md", legend = true, caption }: { parts: FundPart[]; total: number; size?: "md" | "sm"; legend?: boolean; caption: string }) {
  return (
    <figure className="ch-anim">
      <div className={`ch-bar ${size === "sm" ? "is-sm" : ""}`} aria-hidden>
        {parts.map((p) => (
          <span
            key={p.key}
            className={`ch-seg ch-k-${p.key} ${DARK.has(p.key) ? "is-dark" : "is-light"}`}
            style={{ flexGrow: p.amount, flexBasis: 0 }}
            title={`${p.label}: ${usd(p.amount)} (${share(p)})`}
          >
            {size === "md" && p.pct >= 9 && LABELLED.has(p.key) ? `${p.pct}%` : null}
          </span>
        ))}
      </div>
      {legend && (
        <ul className="ch-fund-legend" aria-hidden>
          {parts.map((p) => (
            <li key={p.key}>
              <span className={`ch-sw ch-k-${p.key}`} />
              <span className="min-w-0">{p.label}</span>
              <span className="ch-amt">{usd(p.amount)}</span>
              <span className="ch-pct">
                {share(p)} of the fund{p.items > 0 && ` · ${p.items} ${p.items === 1 ? "item" : "items"}`}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="sr-only">
        <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Area</th>
            <th scope="col">Amount</th>
            <th scope="col">Share</th>
          </tr>
        </thead>
        <tbody>
          {parts.map((p) => (
            <tr key={p.key}>
              <th scope="row">{p.label}</th>
              <td>{usd(p.amount)}</td>
              <td>{share(p)}</td>
            </tr>
          ))}
          <tr>
            <th scope="row">Total</th>
            <td>{usd(total)}</td>
            <td>100%</td>
          </tr>
        </tbody>
        </table>
      </div>
    </figure>
  );
}
