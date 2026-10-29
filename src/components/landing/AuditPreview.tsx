import Link from "next/link";
import { isKept, type AuditRow } from "@/lib/audit";
import type { ProgramItem } from "@/lib/plan";
import { kindOf, shortOrg, shortSignal } from "@/components/ui/labels";
import { Chevron } from "./Chevron";
import { clip } from "./clip";

export interface PreviewRow extends AuditRow {
  n: number;
}

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function verdictLabel(row: AuditRow) {
  if (!isKept(row.verdict)) return row.verdict === "generic" ? "Struck · not local" : "Struck · can’t confirm";
  if (row.verdict === "institution") return `Kept · ${shortOrg(row.named ?? "institution")}`;
  if (row.verdict === "mechanism") return `Kept · ${(row.keptLabel ?? "grant mechanism").replace(/^local /, "")}`;
  return `Kept · ${row.matched?.name ?? "local favourite"}`;
}

// The local partner: what it is and where, one meta line, and the Qloo signal.
function SwapCard({ item: r }: { item: ProgramItem }) {
  const kind = kindOf(r.title);
  const meta = [r.runWith && `with ${shortOrg(r.runWith)}`, r.partner?.distanceKm != null && `${r.partner.distanceKm} km`, usd(r.amount)].filter(Boolean);
  return (
    <div className="lp-swap">
      <p className="lp-swap-title">
        {kind}
        {r.partner && <span> · {shortOrg(r.partner.name)}</span>}
      </p>
      <p className="lp-swap-meta">{meta.join(" · ")}</p>
      {r.provenance[0] && (
        <span className="lp-chip">
          <span aria-hidden="true" className="lp-dot" />
          {shortSignal(r.provenance[0].signal)}
        </span>
      )}
    </div>
  );
}

// A live excerpt of the hero town's check, rendered on the server from today's run. With motion
// allowed, the featured line replays on a loop: the strike (if any), then the local partner.
export function AuditPreview({
  row,
  townLabel,
  href,
  kept,
  struck,
  added,
}: {
  row?: PreviewRow;
  townLabel: string;
  href: string;
  kept: number;
  struck: number;
  added: number;
}) {
  const partner = row && (isKept(row.verdict) ? row.alongside : row.replacement);
  return (
    <figure className="lp-preview" data-replay aria-label={`Excerpt of the ${townLabel} line-by-line check`}>
      <div className="lp-preview-head">
        <div>
          <p className="lp-kicker">{townLabel}</p>
          <p className="lp-preview-title">AI-written draft, checked</p>
        </div>
        <Link href={href} className="lp-preview-open" aria-label="Open the full line-by-line check">
          <Chevron />
        </Link>
      </div>
      <div className="lp-preview-lead">
        <p className="lp-added">
          <span className="lp-added-n">+{added}</span>
          <span className="lp-added-t">local partners added</span>
        </p>
        <p className="lp-tally">
          <span className="is-ok">{kept} kept</span> · <span className={struck ? "is-hivis" : ""}>{struck} struck</span>
        </p>
      </div>
      {row && (
        <div className={`lp-row ${isKept(row.verdict) ? "is-kept" : "is-struck"}`}>
          <p className="lp-draft" title={row.text}>
            {isKept(row.verdict) ? clip(row.text, 34) : <del className="lp-strike">{clip(row.text, 34)}</del>}
          </p>
          <p className={isKept(row.verdict) ? "lp-keep" : "lp-reason"}>
            {isKept(row.verdict) && (
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
                <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {verdictLabel(row)}
          </p>
          {partner && <SwapCard item={partner} />}
        </div>
      )}
    </figure>
  );
}
