import Link from "next/link";
import { isKept, type AuditRow } from "@/lib/audit";
import { BUCKETS, costLine, ROLE_LABEL, type ProgramItem } from "@/lib/plan";
import { Chevron } from "./Chevron";
import { clip } from "./clip";

export interface PreviewRow extends AuditRow {
  n: number;
}

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function strikeReason(row: AuditRow) {
  if (row.verdict === "generic") return "Not local: could fit any town";
  const named = row.reasons[0]?.match(/"([^"]+)"/)?.[1];
  return named ? `Can’t confirm: “${named}” not found locally` : "Can’t confirm: partner not found locally";
}

// Provenance reads in plain words on the landing; the town page keeps the full signal.
export const plainSignal = (signal: string) =>
  signal.replace(/^(?:Qloo place|Local favourite) · #(\d+) by local affinity$/, "#$1 local affinity").replace(/^Qloo place/, "Local place");

// The local partner card: what replaces a struck line, or what is added next to a kept one.
function SwapCard({ item: r, label }: { item: ProgramItem; label?: string }) {
  const meta = [
    r.partner?.distanceKm != null ? `${r.partner.distanceKm} km from site` : null,
    r.partner?.neighbouring ? "Neighbouring community" : null,
    r.partner?.rating ? `Rated ${r.partner.rating.toFixed(1)}` : null,
  ].filter(Boolean);
  return (
    <div className="lp-swap">
      <p className="lp-swap-bucket">
        {label ? `${label} · ` : ""}
        {BUCKETS[r.bucket].label}
      </p>
      <p className="lp-swap-title">{r.title}</p>
      {meta.length > 0 && <p className="lp-swap-meta">{meta.join(" · ")}</p>}
      <p className="lp-swap-meta">
        {r.role ? `${ROLE_LABEL[r.role]} · ` : ""}
        {costLine({ ...r, partner: undefined })}
      </p>
      <div className="lp-swap-foot">
        <span className="lp-amount">
          {usd(r.amount)} <span>item budget</span>
        </span>
        {r.provenance[0] && (
          <span className="lp-chip">
            <span aria-hidden="true" className="lp-dot" />
            {plainSignal(r.provenance[0].signal)}
          </span>
        )}
      </div>
    </div>
  );
}

// A live excerpt of the hero town's check, rendered on the server from today's run. With motion
// allowed, the struck line replays on a loop: the line, the strike, the reason, the replacement.
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
  showGaps = false,
}: {
  showGaps?: boolean;
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
  return (
    <figure className="lp-preview" data-replay aria-label={`Excerpt of the ${townLabel} line-by-line check`}>
      <div className="lp-preview-head">
        <div>
          <p className="lp-kicker">
            {townLabel} · {facility}
          </p>
          <p className="lp-preview-title">The draft plan, checked line by line</p>
          <p className="lp-byline">Written by AI alone (OpenAI, no Qloo data), the way a consultant would</p>
        </div>
      </div>
      <div className="lp-preview-lead">
        <p className="lp-added">
          <span className="lp-added-n">+{added}</span>
          <span className="lp-added-t">local partners the draft never named, added to the program</span>
        </p>
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
            <dt>Lines</dt>
            <dd>{total}</dd>
          </div>
        </dl>
      </div>

      <ol className="lp-rows">
        {rows.map((row, i) => {
          const n = String(row.n);
          // Items between this row and the previous one are summarised, so the numbering never jumps.
          const from = (rows[i - 1]?.n ?? 0) + 1;
          const skipped = verdicts.slice(from - 1, row.n - 1);
          const gap =
            showGaps && skipped.length > 0 ? (
              <li key={`gap-${row.n}`} className="lp-row lp-gap" aria-label={`Items ${from} to ${row.n - 1}`}>
                <span className="lp-num">
                  {String(from)}
                  {skipped.length > 1 ? `–${row.n - 1}` : ""}
                </span>
                <p>
                  {skipped.every(isKept)
                    ? `${skipped.length} more ${skipped.length > 1 ? "items" : "item"} kept, grounded locally`
                    : `${skipped.length} more ${skipped.length > 1 ? "items" : "item"} in the full audit`}
                </p>
              </li>
            ) : null;
          if (isKept(row.verdict)) {
            const [label, source] =
              row.verdict === "institution"
                ? [`Kept: ${row.named}`, "institution, couldn’t verify here · confirm with the committee"]
                : row.verdict === "mechanism"
                  ? [`Kept · ${row.keptLabel ?? "grant mechanism"}`, row.keptNote ?? "Qloo suggests the applicants"]
                  : [`Kept: ${row.matched?.name ?? "matches a local favourite"}`, row.matched?.source === "osm" ? "verified on OpenStreetMap" : "a local place from Qloo, within 15 km"];
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
                  {label}
                  <span className="lp-keep-src">{source}</span>
                </p>
                {row.alongside && <SwapCard item={row.alongside} label="Added alongside" />}
              </li>,
            ];
          }
          const r = row.replacement!;
          return [
            gap,
            <li key={row.n} className="lp-row is-struck">
              <span className="lp-num">{n}</span>
              <div className="lp-row-draft">
                <p className="lp-draft" title={row.text}>
                  <del className="lp-strike">{row.text}</del>
                </p>
                <p className="lp-reason">{strikeReason(row)}</p>
              </div>
              <SwapCard item={r} />
            </li>,
          ];
        })}
        {showGaps && (() => {
          const last = rows[rows.length - 1]?.n ?? 0;
          const rest = verdicts.slice(last);
          if (!rest.length) return null;
          const restKept = rest.filter(isKept).length;
          const restStruck = rest.length - restKept;
          return (
            <li className="lp-row lp-gap" aria-label={`Items ${last + 1} to ${verdicts.length}`}>
              <span className="lp-num">
                {last + 1}–{verdicts.length}
              </span>
              <p>
                {restStruck} more struck, {restKept} kept, in the full audit
              </p>
            </li>
          );
        })()}
      </ol>

      <figcaption className="lp-preview-foot">
        <span>The institutions the draft names stay in.</span>
        <Link href={href} className="lp-textlink">
          See every line <Chevron />
        </Link>
      </figcaption>
    </figure>
  );
}
