import Link from "next/link";
import type { AuditRow } from "@/lib/audit";
import { BUCKETS } from "@/lib/plan";
import { Chevron } from "./Chevron";

export interface PreviewRow extends AuditRow {
  n: number;
}

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

// Trim long draft items at a word boundary so the strike ends where the text does.
function clip(text: string, max = 96) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:]$/, "")}…`;
}

function strikeReason(row: AuditRow) {
  if (row.verdict === "generic") return "Generic: names nothing local";
  const named = row.reasons[0]?.match(/"([^"]+)"/)?.[1];
  return named ? `Unverified: “${named}” not found locally` : "Unverified: partner not found locally";
}

// A live excerpt of the hero town's audit, rendered on the server from today's run.
export function AuditPreview({
  rows,
  townLabel,
  facility,
  href,
  kept,
  struck,
  total,
  added,
  verdicts,
}: {
  rows: PreviewRow[];
  verdicts: AuditRow["verdict"][];
  townLabel: string;
  facility: string;
  href: string;
  kept: number;
  struck: number;
  total: number;
  added: number;
}) {
  let strikeIndex = 0;
  return (
    <figure className="lp-preview" aria-label={`Excerpt of the ${townLabel} plan audit`}>
      <div className="lp-preview-head">
        <div>
          <p className="lp-kicker">
            {townLabel} · {facility}
          </p>
          <p className="lp-preview-title">Draft community plan, checked item by item</p>
        </div>
        <dl className="lp-tally">
          <div>
            <dt>Kept</dt>
            <dd className="is-ok">{kept}</dd>
          </div>
          <div>
            <dt>Struck</dt>
            <dd className="is-hivis">{struck}</dd>
          </div>
          <div>
            <dt>of</dt>
            <dd>{total}</dd>
          </div>
        </dl>
      </div>

      <ol className="lp-rows">
        {rows.map((row, i) => {
          const n = String(row.n).padStart(2, "0");
          // Items between this row and the previous one are summarised, so the numbering never jumps.
          const from = (rows[i - 1]?.n ?? 0) + 1;
          const skipped = verdicts.slice(from - 1, row.n - 1);
          const gap =
            skipped.length > 0 ? (
              <li key={`gap-${row.n}`} className="lp-row lp-gap" aria-label={`Items ${from} to ${row.n - 1}`}>
                <span className="lp-num">
                  {String(from).padStart(2, "0")}
                  {skipped.length > 1 ? `–${String(row.n - 1).padStart(2, "0")}` : ""}
                </span>
                <p>
                  {skipped.every((v) => v === "grounded")
                    ? `${skipped.length} more ${skipped.length > 1 ? "items" : "item"} kept, grounded locally`
                    : `${skipped.length} more ${skipped.length > 1 ? "items" : "item"} in the full audit`}
                </p>
              </li>
            ) : null;
          if (row.verdict === "grounded") {
            return [
              gap,
              <li key={row.n} className="lp-row is-kept">
                <span className="lp-num">{n}</span>
                <p className="lp-draft" title={row.text}>
                  {clip(row.text, 110)}
                </p>
                <p className="lp-keep">
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
                    <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Kept: {row.matched?.name}
                  <span className="lp-keep-src">
                    {row.matched?.source === "osm" ? "verified on OpenStreetMap" : "in Qloo’s local data"}
                  </span>
                </p>
              </li>,
            ];
          }
          const r = row.replacement!;
          const delay = 500 + strikeIndex++ * 520;
          const meta = [
            r.partner?.distanceKm != null ? `${r.partner.distanceKm} km from site` : null,
            r.partner?.rating ? `Rated ${r.partner.rating.toFixed(1)}` : null,
            r.partner?.eventSpaces ? "Event space" : null,
          ].filter(Boolean);
          return [
            gap,
            <li key={row.n} className="lp-row is-struck" style={{ "--d": `${delay}ms` } as React.CSSProperties}>
              <span className="lp-num">{n}</span>
              <div className="lp-row-draft">
                <p className="lp-draft" title={row.text}>
                  <del className="lp-strike">{clip(row.text)}</del>
                </p>
                <p className="lp-reason">{strikeReason(row)}</p>
              </div>
              <div className="lp-swap">
                <p className="lp-swap-bucket">{BUCKETS[r.bucket].label}</p>
                <p className="lp-swap-title">{r.title}</p>
                {meta.length > 0 && <p className="lp-swap-meta">{meta.join(" · ")}</p>}
                <div className="lp-swap-foot">
                  <span className="lp-amount">
                    {usd(r.amount)} <span>from your fund</span>
                  </span>
                  {r.provenance[0] && (
                    <span className="lp-chip">
                      <span aria-hidden="true" className="lp-dot" />
                      {r.provenance[0].signal}
                    </span>
                  )}
                </div>
              </div>
            </li>,
          ];
        })}
        {(() => {
          const last = rows[rows.length - 1]?.n ?? 0;
          const rest = verdicts.slice(last);
          if (!rest.length) return null;
          const restKept = rest.filter((v) => v === "grounded").length;
          const restStruck = rest.length - restKept;
          return (
            <li className="lp-row lp-gap" aria-label={`Items ${last + 1} to ${verdicts.length}`}>
              <span className="lp-num">
                {String(last + 1).padStart(2, "0")}–{String(verdicts.length).padStart(2, "0")}
              </span>
              <p>
                {restStruck} more struck, {restKept} kept, in the full audit
              </p>
            </li>
          );
        })()}
      </ol>

      <figcaption className="lp-preview-foot">
        <span>
          + {added} local partners the draft never named
        </span>
        <Link href={href} className="lp-textlink">
          See the full audit <Chevron />
        </Link>
      </figcaption>
    </figure>
  );
}
