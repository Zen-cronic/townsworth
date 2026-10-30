"use client";

import Link from "next/link";
import { PRODUCT_NAME } from "@/components/landing/brand";
import type { AuditRow, Verdict } from "@/lib/audit";
import { SEARCH_RADIUS_KM } from "@/lib/geo";
import { BUCKETS, type ProgramItem } from "@/lib/plan";
import type { CheckResult } from "@/lib/userPlan";
import { Chevron, Notice } from "@/components/dashboard/Icons";
import { Figure } from "@/components/dashboard/Figure";
import { ProvenanceChip } from "@/components/dashboard/ProvenanceChip";
import { Chip, VerdictMark } from "@/components/ui";
import { cadenceLower, formatPhone, km, quotedName } from "@/components/dashboard/format";
import { secondaryCta } from "@/components/dashboard/ui";
import { CheckExports } from "./CheckExports";
import { LiveDataNotice } from "@/components/LiveDataNotice";
import { AgeStrip } from "@/components/qloo/AgeStrip";
import { TraitLine } from "@/components/qloo/PlaceTraits";
import { FundBar, StruckTally, PartnerNames, fundSplit, lineComposition, partnerPoints } from "@/components/charts";

// The audit of a pasted draft, rendered from the JSON the check route returns. Same verdict
// vocabulary as the town pages; audit.ts stays out of the client bundle (it carries the baseline).

const isKept = (v: Verdict) => v === "grounded" || v === "institution" || v === "mechanism";

const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
// "2 sessions × $9,000": the cost basis without the partner name, which the title already carries.
const unitLine = (it: ProgramItem) => `${it.sessions} ${it.sessions === 1 ? it.unit : `${it.unit}s`} × ${money(it.unitCost)}`;
// Draft lines are numbered plainly.
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Every answer is an indented column under one hairline (see .gn-proposal), never a box.
const CARD = {
  kept: "gn-proposal",
  proposed: "gn-proposal slide-in",
  none: "gn-proposal",
};

function Eyebrow({ tone, children }: { tone: "ok" | "muted"; children: React.ReactNode }) {
  return (
    <p className={`flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider ${tone === "ok" ? "text-ok-text" : "text-muted"}`}>
      {children}
    </p>
  );
}

// The venue facts a reader needs only when reaching out: behind the item's own disclosure.
function VenueFacts({ item }: { item: ProgramItem }) {
  const p = item.partner;
  if (!p) return null;
  const facts = [p.address, p.rating != null && `Rated ${p.rating.toFixed(1)}`, p.eventSpaces && "Event space", formatPhone(p.phone)].filter(Boolean) as string[];
  if (!facts.length) return null;
  return (
    <details className="rp-more mt-2">
      <summary>Venue details</summary>
      <p className="mt-1 text-xs leading-relaxed text-muted">{facts.join(" · ")}</p>
    </details>
  );
}

function PartnerFacts({ item }: { item: ProgramItem }) {
  const p = item.partner;
  if (!p) return null;
  return (
    <>
      <TraitLine traits={p.traits} className="mt-1 text-[12px] leading-4" />
      <AgeStrip ages={p.ages} className="mt-1 text-[12px] leading-4" />
    </>
  );
}

function proposalMeta(item: ProgramItem) {
  const p = item.partner;
  return [unitLine(item), cadenceLower(item.cadence), p && km(p.distanceKm) && `${km(p.distanceKm)} from site`, p?.neighbouring && (p.city ?? "Neighbouring community")]
    .filter(Boolean)
    .join(" · ");
}

function Proposal({ item, label = "Proposed" }: { item: ProgramItem; label?: string }) {
  return (
    <div className={CARD.proposed}>
      <Eyebrow tone="ok">{label}</Eyebrow>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <p className="text-[15px] font-medium leading-snug">{item.title}</p>
        <span className="rp-amount shrink-0 font-mono text-sm tabular-nums">{money(item.amount)}</span>
      </div>
      <p className="mt-1 text-xs text-muted">{proposalMeta(item)}</p>
      <PartnerFacts item={item} />
      <div className="mt-2.5">
        <ProvenanceChip item={item} />
      </div>
      <VenueFacts item={item} />
    </div>
  );
}

function Kept({ row }: { row: AuditRow }) {
  if (row.verdict === "institution") {
    return (
      <div className={CARD.kept}>
        <Eyebrow tone="ok">
          <VerdictMark kind="kept" className="kept-mark" />
          Kept <span className="font-normal normal-case tracking-normal text-muted">· institution, couldn&apos;t verify here</span>
        </Eyebrow>
        <p className="mt-1 text-[15px] leading-snug">{row.named}</p>
        <p className="mt-0.5 text-xs text-muted">Not in Qloo&apos;s places or OpenStreetMap nearby. Confirm with the committee.</p>
      </div>
    );
  }
  if (row.verdict === "mechanism") {
    const applicants = row.applicants ?? [];
    return (
      <div className={CARD.kept}>
        <Eyebrow tone="ok">
          <VerdictMark kind="kept" className="kept-mark" />
          Kept <span className="font-normal normal-case tracking-normal text-muted">· {row.keptLabel ?? "grant mechanism"}</span>
        </Eyebrow>
        <p className="mt-1 text-[15px] leading-snug">{row.keptNote ? row.keptNote.charAt(0).toUpperCase() + row.keptNote.slice(1) + "." : "How grants are decided stays as drafted."}</p>
        {applicants.length > 0 && (
          <div className="mt-2 space-y-1.5">
            <p className="text-xs font-medium text-ink">Suggested applicants from Qloo:</p>
            <ul className="space-y-1.5">
              {applicants.map((a) => (
                <li key={a.id} className="text-xs text-muted">
                  <span className="text-ink">{a.partner?.name ?? a.title}</span> · <span className="font-mono tabular-nums">{unitLine(a)}</span>
                  <div className="mt-1">
                    <ProvenanceChip item={a} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className={CARD.kept}>
      <Eyebrow tone="ok">
        <VerdictMark kind="kept" className="kept-mark" />
        Kept
      </Eyebrow>
      <p className="mt-1 text-[15px] leading-snug">{row.matched?.name ?? "Matches a local favourite"}</p>
      <p className="mt-0.5 text-xs text-muted">
        {row.matched
          ? [row.matched.source === "osm" ? "Verified on OpenStreetMap" : row.matched.source === "qloo-search" ? `Qloo knows this place, within ${SEARCH_RADIUS_KM} km` : "A local place in Qloo's data, within 15 km", km(row.matched.distanceKm) && `${km(row.matched.distanceKm)} away`]
              .filter(Boolean)
              .join(" · ")
          : row.termHits[0]}
      </p>
    </div>
  );
}

const ROW = "grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-3 border-b border-hairline py-4 last:border-b-0 md:grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)] md:gap-x-6";

// The reason under a draft line, only where the answer column doesn't already say it: a matched
// partner and an institution explain themselves there, and "Not local" is the reason for a generic line.
const showReason = (row: AuditRow) => !(row.verdict === "generic" || row.verdict === "institution" || (row.verdict === "grounded" && row.matched));

function AuditLine({ row, index }: { row: AuditRow; index: number }) {
  const kept = isKept(row.verdict);
  const missing = row.verdict === "unverified" ? quotedName(row.reasons[0]) : undefined;
  return (
    <li data-testid="check-row" data-verdict={row.verdict} className={`${ROW} audit-row row-edge ${kept ? "is-kept" : "is-struck"}${row.verdict === "unverified" ? " is-unsure" : ""} break-inside-avoid`}>
      <span className="pt-0.5 font-mono text-xs tabular-nums text-muted">{index + 1}</span>
      <div className="min-w-0">
        <p className={`text-[15px] leading-relaxed ${kept ? "text-ink" : "text-muted"}`}>
          <span className={kept ? "" : "strike"} style={kept ? undefined : { animationDelay: `${index * 70}ms` }}>
            {row.text}
          </span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          {kept ? <Chip>Kept</Chip> : row.verdict === "unverified" ? <Chip tone="unsure">Can&apos;t confirm</Chip> : <Chip tone="pen">Not local</Chip>}
          <span className="text-xs text-muted">{BUCKETS[row.bucket].label}</span>
        </div>
        {missing ? (
          <p className="mt-1.5 text-xs leading-relaxed text-muted">&ldquo;{missing}&rdquo; isn&apos;t in Qloo or OpenStreetMap nearby. It may exist; it can&apos;t be checked here.</p>
        ) : (
          showReason(row) && <p className="mt-1.5 text-xs leading-relaxed text-muted">{row.reasons[0]}</p>
        )}
      </div>
      <div className="col-start-2 space-y-2 md:col-start-3">
        {kept ? (
          <Kept row={row} />
        ) : row.replacement ? (
          <Proposal item={row.replacement} />
        ) : (
          <div className={CARD.none}>
            <Eyebrow tone="muted">No local swap</Eyebrow>
            <p className="mt-1 text-[15px] leading-snug text-muted">This budget moves into the committee&apos;s reserve.</p>
          </div>
        )}
        {row.alongside && <Proposal item={row.alongside} label="Added alongside" />}
      </div>
    </li>
  );
}

// One summary cell. Without a figure it holds the struck tally, which carries its own.
function Stat({ title, figure, tone, children }: { title?: string; figure?: string; tone: "struck" | "ok" | "qloo"; children: React.ReactNode }) {
  return (
    <div className={`check-stat is-${tone} flex flex-col px-4 py-3.5 sm:px-6 sm:py-5`}>
      {title && <p className="check-stat-k text-[13px] font-semibold">{title}</p>}
      {figure && (
        <p className="ui-stat-v mt-2 sm:mt-3">
          <Figure value={figure} />
        </p>
      )}
      <div className={`${figure ? "mt-3 " : ""}text-sm leading-snug text-muted`}>{children}</div>
    </div>
  );
}

function Note({ tone, children }: { tone: "amber" | "flag"; children: React.ReactNode }) {
  return (
    <p
      role="note"
      className={`mt-2 flex gap-2 rounded-md border px-3 py-2 text-sm ${tone === "flag" ? "border-hivis/35 bg-hivis-wash" : "border-amber/35 bg-amber-wash"}`}
    >
      <Notice className={`mt-0.5 h-4 w-4 ${tone === "flag" ? "text-hivis-text" : "text-amber"}`} />
      <span>{children}</span>
    </p>
  );
}

export function CheckResults({ result }: { result: CheckResult }) {
  const { town, audit, qlooAdds, program, parse, osm, qlooSearch, profile } = result;
  const keptPartners = audit.filter((a) => a.verdict === "grounded" && a.matched).length;
  const keptSignals = audit.filter((a) => a.verdict === "grounded" && !a.matched).length;
  const keptInstitutions = audit.filter((a) => a.verdict === "institution").length;
  const keptMechanisms = audit.filter((a) => a.verdict === "mechanism").length;
  const partnerPlaces = program.items.filter((it) => it.partner).length;
  const swapPlaces = audit.filter((a) => a.replacement?.partner).length;
  const alongsidePlaces = audit.filter((a) => a.alongside?.partner).length;
  const comp = lineComposition(audit);
  const fund = fundSplit(program.items, program.unassigned);
  const partners = partnerPoints(program.items);
  const secs = (ms: number) => `${Math.max(1, Math.round(ms / 1000))} s`;

  const parseLine =
    parse.method === "model"
      ? `Split into ${plural(parse.items, "item", "items")} by OpenAI ${parse.model}; verdicts come from fixed rules, not the model.`
      : `Split into ${plural(parse.items, "item", "items")} line by line; verdicts come from fixed rules, not a model.`;

  return (
    <section aria-labelledby="check-title" className="check-results mt-8 print:mt-0">
      <p className="mb-3 hidden text-xs text-muted print:block">
        {PRODUCT_NAME} · your draft checked against {town.name}, {town.region} · annual fund {money(result.annualFund)} · printed{" "}
        {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date())}. Nothing you pasted was stored.
      </p>
      <div className="doc-sheet rounded-lg">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-rule px-5 pb-4 pt-5 sm:px-6">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted">Line-by-line check · {plural(audit.length, "draft item", "draft items")}</p>
            <h2 id="check-title" className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">
              Your draft, checked against {town.name}, {town.region}
            </h2>
            <details className="rp-more mt-2">
              <summary>How this was checked</summary>
              <ul className="mt-2 space-y-1 border-l border-rule pl-3 text-xs leading-relaxed text-muted">
                <li>{parseLine}</li>
                {osm.checked > 0 && <li>{plural(osm.checked, "name", "names")} looked up on OpenStreetMap.</li>}
                {qlooSearch.checked > 0 && (
                  <li>
                    {plural(qlooSearch.checked, "name", "names")} searched in Qloo, {qlooSearch.verified} found within {SEARCH_RADIUS_KM} km.
                  </li>
                )}
                <li>Took {secs(result.ms)}.</li>
              </ul>
            </details>
            {parse.notice && <Note tone="amber">{parse.notice}</Note>}
            {parse.truncated && <Note tone="amber">Only the first 40 items were checked. Split a longer plan into parts.</Note>}
            {osm.failures > 0 && (
              <Note tone="amber">
                {plural(osm.failures, "OpenStreetMap lookup", "OpenStreetMap lookups")} didn&apos;t answer, so {osm.failures === 1 ? "that name counts" : "those names count"} as
                unverified. Check again in a minute.
              </Note>
            )}
            {qlooSearch.failures > 0 && (
              <Note tone="amber">
                {plural(qlooSearch.failures, "Qloo name search", "Qloo name searches")} didn&apos;t answer, so {qlooSearch.failures === 1 ? "that name stays" : "those names stay"} as
                the other checks left {qlooSearch.failures === 1 ? "it" : "them"}. Check again in a minute.
              </Note>
            )}
            {profile.failedCalls > 0 && (
              <Note tone="flag">
                <span className="font-semibold">Qloo didn&apos;t answer; this is not thin data.</span> {profile.failedCalls} of {profile.calls.length} Qloo calls
                failed, so this check is missing signals. Check again in a minute.
              </Note>
            )}
            {profile.thin && (
              <Note tone="amber">
                <span className="font-semibold">Limited local data.</span> Qloo has few local signals near {town.name} ({profile.localPlaces} independent{" "}
                {profile.localPlaces === 1 ? "place" : "places"} within 15 km). Treat the replacements as a starting list.
              </Note>
            )}
          </div>
          <CheckExports result={result} />
        </div>

        <div className="grid gap-px border-b border-rule bg-hairline sm:grid-cols-3">
          <Stat tone={comp.generic + comp.unverified > 0 ? "struck" : "ok"}>
            <StruckTally comp={comp} draft="Your draft" />
            <p className="mt-2 text-xs">
              Kept:{" "}
              {[
                plural(keptPartners, "local partner", "local partners"),
                keptInstitutions > 0 && plural(keptInstitutions, "institution to confirm", "institutions to confirm"),
                keptMechanisms > 0 && `${keptMechanisms} as drafted`,
                keptSignals > 0 && plural(keptSignals, "local favourite", "local favourites"),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </Stat>
          <Stat tone="qloo" title="Local partners Qloo found" figure={String(partnerPlaces)}>
            {profile.failedCalls > 0 ? <LiveDataNotice towns={[town.name]} subject="the partner list" /> : <PartnerNames points={partners} />}
            <p className="mt-2 text-xs">
              <span className="font-mono tabular-nums text-ink">{swapPlaces}</span> swapped in
              {alongsidePlaces > 0 && (
                <>
                  {" "}
                  · <span className="font-mono tabular-nums text-ink">{alongsidePlaces}</span> added alongside
                </>
              )}{" "}
              · <span className="font-mono tabular-nums text-ink">{qlooAdds.length}</span> new to your draft
            </p>
          </Stat>
          <Stat tone="ok" title="Costed for the committee" figure={money(program.totalAllocated)}>
            <p className="mt-2 text-xs">
              {plural(program.items.length, "item", "items")} over 24 months ·{" "}
              <span className="font-mono tabular-nums text-ink">{money(program.unassigned)}</span> reserve
            </p>
          </Stat>
        </div>

        <details className="group border-b border-hairline bg-concrete/50 px-5 py-2.5 text-xs text-muted sm:px-6">
          <summary className="flex cursor-pointer flex-wrap items-center gap-2">
            <Chip tone="pen">Not local</Chip>
            <Chip tone="unsure">Can&apos;t confirm</Chip>
            <Chip>Kept</Chip>
            <span className="rp-legend-q font-medium text-ink">What do these mean?</span>
          </summary>
        <dl className="mt-3 grid gap-x-6 gap-y-2 md:grid-cols-3">
          <div className="flex items-start gap-2">
            <dt>
              <Chip tone="pen">Not local</Chip>
            </dt>
            <dd className="pt-0.5">Names no local partner and matches nothing this town stands out for.</dd>
          </div>
          <div className="flex items-start gap-2">
            <dt>
              <Chip tone="unsure">Can&apos;t confirm</Chip>
            </dt>
            <dd className="pt-0.5">Names a partner that isn&apos;t an institution and isn&apos;t found in Qloo or OpenStreetMap. It may exist; it can&apos;t be checked here.</dd>
          </div>
          <div className="flex items-start gap-2">
            <dt className="flex items-center gap-1 pt-0.5 font-medium text-ok-text">
              <VerdictMark kind="kept" />
              Kept
            </dt>
            <dd className="pt-0.5">
              Names a verified local partner or something the town stands out for, or an institution (EDC, district, college, department) we can&apos;t check
              here: those stay, for the committee to confirm. Grant mechanisms stay too, with Qloo&apos;s suggested applicants.
            </dd>
          </div>
        </dl>
        </details>

        <div className="hidden grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)] gap-x-6 border-b border-hairline px-6 py-2 text-[11px] font-medium uppercase tracking-wider text-muted md:grid">
          <span>#</span>
          <span>Your draft item</span>
          <span>{PRODUCT_NAME}</span>
        </div>

        {audit.length ? (
          <ol className="px-5 sm:px-6">
            {audit.map((row, i) => (
              <AuditLine key={i} row={row} index={i} />
            ))}
          </ol>
        ) : (
          <p className="px-6 py-10 text-center text-sm text-muted">No commitments were found in this text. Put one commitment per line and check again.</p>
        )}

        <div className="border-t border-rule bg-concrete/50 px-5 py-4 text-xs text-muted sm:px-6">
          <p className="max-w-2xl">Amounts come from your fund, never from Qloo.</p>
        </div>
      </div>

      <section aria-labelledby="fund-title" className="ui-section break-inside-avoid">
        <h3 id="fund-title" className="font-semibold tracking-tight">
          Where the fund goes
        </h3>
        <p className="mt-0.5 font-mono text-xs tabular-nums text-muted">{money(fund.total)} over 24 months</p>
        <div className="mt-4">
          <FundBar parts={fund.parts} total={fund.total} caption={`The ${money(fund.total)} 24-month fund by program area`} />
        </div>
      </section>

      <section aria-labelledby="adds-title" className="ui-section break-inside-avoid">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule px-5 py-4 sm:px-6">
          <div className="max-w-2xl">
            <h3 id="adds-title" className="font-semibold tracking-tight">
              Qloo also suggests
            </h3>
            <p className="mt-0.5 text-sm text-muted">More places residents go that your draft never mentions.</p>
          </div>
          <p className="font-mono text-xs tabular-nums text-muted">{plural(qlooAdds.length, "more local partner", "more local partners")}</p>
        </div>
        {qlooAdds.length ? (
          <ul className="divide-y divide-hairline">
            {qlooAdds.map((it) => (
              <li key={it.id} className="row-edge is-kept grid gap-x-4 gap-y-1 px-5 py-3 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
                  <p className="font-medium leading-snug">{it.title}</p>
                  <p className="mt-0.5 text-xs text-muted">{[BUCKETS[it.bucket].label, proposalMeta(it)].join(" · ")}</p>
                  <div className="mt-1.5">
                    <ProvenanceChip item={it} />
                  </div>
                </div>
                <p className="rp-amount font-mono text-sm tabular-nums md:text-right">{money(it.amount)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-6 py-6 text-sm text-muted">No further local partners for {town.name} beyond the swaps above.</p>
        )}
      </section>

      <section className="ui-section grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <div className="min-w-0 text-sm">
          <details className="rp-more">
            <summary>What this check is, and isn&apos;t</summary>
            <ul className="mt-2 space-y-1.5">
              <li>The model only splits your text into items. Which lines are kept or struck comes from the same fixed rules as the town pages.</li>
              <li>A struck line isn&apos;t wrong; it could fit any town. A kept institution still needs the committee to confirm it.</li>
            </ul>
          </details>
          <p className="mt-2 text-muted">Nothing you pasted is stored.</p>
          <Link href={`/town/${town.slug}?fund=${result.annualFund}`} className={`${secondaryCta} no-print mt-3`}>
            Memo, outreach drafts and ballot for {town.name}
            <Chevron className="h-3.5 w-3.5" />
          </Link>
        </div>
        <p className="ui-note self-start">
          Guardrails: not tied to any vote or permit · residents rank · no political, religious or identity targeting ({profile.excluded} excluded by
          rule) · the sponsor is named on every message. <Link href="/sources#data">Sources</Link>
        </p>
      </section>
    </section>
  );
}
