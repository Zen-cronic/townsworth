import Link from "next/link";
import { money, type PlanSource, type TownRun } from "@/lib/run";
import { BUCKETS, costLine, type ProgramItem } from "@/lib/plan";
import { isKept, type AuditRow } from "@/lib/audit";
import { Chevron, Notice } from "@/components/dashboard/Icons";
import { secondaryCta } from "@/components/dashboard/ui";
import { Card, Chip, PageBand, SectionHeader, SplitCta, StatTile, VerdictMark } from "@/components/ui";
import { cadenceLower, formatPhone, km, quotedName } from "@/components/dashboard/format";
import { AuditTools } from "@/components/town/AuditTools";
import { DraftLine } from "@/components/town/DraftLine";
import { TownSchematic } from "@/components/town/TownSchematic";
import { keptBreakdown } from "@/components/ui/keptBreakdown";
import { isQlooSignal, kindOf, LOCAL_AFFINITY, shortOrg, shortSignal, shortTermHit } from "@/components/ui/labels";
import { LiveDataNotice } from "@/components/LiveDataNotice";
import { AudienceReach } from "@/components/qloo/AudienceReach";
import { AgeStrip } from "@/components/qloo/AgeStrip";
import { PlaceTraits, TraitLine } from "@/components/qloo/PlaceTraits";
import { FundBar, PartnerDistance, PartnerNames, StruckTally, SessionTimeline, fundSplit, lineComposition, partnerPoints, sessionsByBucket } from "@/components/charts";

const FACILITY_LABEL: Record<string, string> = {
  "data center": "Data center",
  fab: "Chip fab",
  nuclear: "Nuclear plant",
  plant: "Plant",
};

const DRAFT: Record<PlanSource, { tab: string; note: string }> = {
  llm: {
    tab: "AI-written draft",
    note: "Written by AI without Qloo data, and fixed before it was checked.",
  },
  agency: {
    tab: "Consultant template",
    note: "The generic plan a consultancy might send to any town.",
  },
};

// The audited draft's provenance line. A typed-in town has no frozen plan, and says so.
function draftNote(run: TownRun): string {
  const { draft, source, town } = run;
  if (draft.origin === "live" && draft.live) {
    const secs = Math.round((draft.live.llmMs + draft.live.osmMs) / 1000);
    const failed = draft.live.osmFailures ? ` ${draft.live.osmFailures} OpenStreetMap checks didn't answer and count as unverified.` : "";
    const fresh = Date.now() - Date.parse(draft.live.createdAt) < 10 * 60_000;
    const when = fresh
      ? "just now"
      : `on ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Toronto" }).format(new Date(draft.live.createdAt))}`;
    return `Written live by OpenAI ${draft.live.model} ${when} (${secs} s, no Qloo access), not part of the frozen set on /proof.${failed}`;
  }
  if (town.custom && source === "agency") return "No frozen AI-written plan for this town; checking the typical consultant template.";
  return DRAFT[source].note;
}

const TASTE_LABEL = { brand: "Brands", artist: "Artists", tv_show: "TV", podcast: "Podcasts" } as const;

// Draft lines are referred to plainly ("Line 4"), and anchored as #line-4.
const num = (n: number) => String(n);

// Everything behind "Why": the signals, the facts about the partner, and how the cost is built.
function Why({ item, gloss }: { item: ProgramItem; gloss?: string }) {
  const p = item.partner;
  const facts = [
    p?.neighbouring && `Neighbouring community${p.city ? ` (${p.city})` : ""}`,
    p?.rating != null && `Rated ${p.rating.toFixed(1)}`,
    p?.eventSpaces && "Event space",
    formatPhone(p?.phone),
  ].filter(Boolean) as string[];
  return (
    <details className="group text-xs">
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-2.5 gap-y-1">
        <Chip tone={isQlooSignal(item.provenance[0]?.signal) ? "qloo" : "plain"}>{shortSignal(item.provenance[0]?.signal)}</Chip>
        <span className="inline-flex items-center gap-0.5 font-medium text-ink underline decoration-rule underline-offset-2 transition-colors duration-150 group-hover:decoration-ink">
          Why
          <Chevron className="chev h-3 w-3" />
        </span>
      </summary>
      <div className="mt-2 space-y-1.5 border-l border-rule pl-3 leading-relaxed text-muted">
        {gloss && <p>{gloss}</p>}
        {item.provenance.map((pv, i) => (
          <p key={i}>
            <span className="font-mono text-ink">{pv.signal}</span>: {pv.detail}
          </p>
        ))}
        <TraitLine traits={p?.traits} />
        {facts.length > 0 && <p>{facts.join(" · ")}</p>}
        <AgeStrip ages={p?.ages} />
        <p>
          {costLine(item)} · {cadenceLower(item.cadence)}
        </p>
      </div>
    </details>
  );
}

// A local partner: the venue leads, the kind of item is its category line, then one meta line
// (program area · run with · distance · cost) and the signal.
function Proposal({ item, label, gloss }: { item: ProgramItem; label: string; gloss?: string }) {
  const meta = [BUCKETS[item.bucket].label, item.runWith && `with ${shortOrg(item.runWith)}`, km(item.partner?.distanceKm), money(item.amount)].filter(Boolean);
  return (
    <div className="gn-proposal slide-in rounded-md border border-ok/40 bg-card px-3.5 py-3">
      <p className="gn-proposal-k text-[11px] font-medium uppercase tracking-wider text-ok-text">
        {label}
        {item.partner && <span className="font-normal normal-case tracking-normal text-muted"> · {kindOf(item.title)}</span>}
      </p>
      <p className="gn-proposal-t mt-1 text-[15px] font-medium leading-snug">{item.partner ? shortOrg(item.partner.name) : kindOf(item.title)}</p>
      <p className="gn-proposal-m mt-0.5 font-mono text-xs tabular-nums text-muted">{meta.join(" · ")}</p>
      <div className="mt-2">
        <Why item={item} gloss={gloss} />
      </div>
    </div>
  );
}

// Grant mechanisms: Qloo's grant candidates on one line, each with its affinity rank.
function Applicants({ items }: { items: ProgramItem[] }) {
  const named = items.filter((a) => a.partner);
  if (!named.length) return null;
  return (
    <p className="pl-[1.375rem] text-xs leading-6 text-muted">
      <span className="font-medium text-ink">Suggested applicants:</span>{" "}
      {named.map((a) => {
        const signal = a.provenance[0]?.signal ?? "";
        const rank = signal.match(LOCAL_AFFINITY)?.[1] ?? a.partner!.affinityRank;
        return (
          <span key={a.id} className="block">
            <span className="text-ink">{shortOrg(a.partner!.name)}</span>
            {rank != null && (
              <>
                {" "}
                <Chip tone="qloo" className="align-middle">#{rank} local affinity</Chip>
              </>
            )}
          </span>
        );
      })}
    </p>
  );
}

// Kept lines: a check, a short verdict, the partner. Details sit behind the draft text's "more".
function Kept({ row, sameAs }: { row: AuditRow; sameAs?: string }) {
  // A line kept on a local signal has no partner: it names the matched theme instead.
  const bySignal = row.verdict === "grounded" && !row.matched && row.keptAs !== "host";
  const [name, how] =
    row.verdict === "institution"
      ? [shortOrg(row.named ?? "Institution"), "institution, couldn't verify here"]
      : row.verdict === "mechanism"
        ? [row.keptLabel ?? "grant mechanism", "kept as drafted"]
        : row.keptAs === "host"
          ? [row.keptLabel ?? "host community", "kept as drafted"]
          : bySignal
            ? ["matches a local favourite", shortTermHit(row.termHits[0])]
            : [row.matched?.name ?? "local partner", `${row.matched?.source === "osm" ? "OpenStreetMap" : "Qloo"}${km(row.matched?.distanceKm) ? ` · ${km(row.matched?.distanceKm)}` : ""}`];
  const note = sameAs ? `same as line ${sameAs}` : how;
  return (
    <>
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 pt-0.5 text-sm leading-snug">
        <VerdictMark kind="kept" className="kept-mark translate-y-0.5" />
        <span className="kept-label">Kept</span>
        {bySignal && (
          <span aria-hidden className="-mx-1 text-muted">
            ·
          </span>
        )}
        <span className="font-medium">{name}</span>
        {note && <span className="font-mono text-xs text-muted">{note}</span>}
      </p>
      {row.applicants && row.applicants.length > 0 && <Applicants items={row.applicants} />}
    </>
  );
}

const ROW = "grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 border-b border-hairline py-4 last:border-b-0 md:grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)] md:gap-x-6";

function AuditLine({ row, index, sameAs, gloss }: { row: AuditRow; index: number; sameAs?: string; gloss?: string }) {
  const kept = isKept(row.verdict);
  const missing = row.verdict === "unverified" ? quotedName(row.reasons[0]) : undefined;
  return (
    <li id={`line-${num(index + 1)}`} tabIndex={-1} className={`${ROW} audit-row row-edge ${kept ? "is-kept" : "is-struck"}${row.verdict === "unverified" ? " is-unsure" : ""} scroll-mt-24`}>
      <span className="pt-0.5 font-mono text-xs tabular-nums text-muted">{num(index + 1)}</span>
      <div>
        <DraftLine text={row.text} struck={!kept} line={index + 1} />
        {row.verdict === "unverified" && (
          <p className="mt-1.5 flex flex-wrap items-center gap-2">
            <Chip tone="unsure">Can&apos;t confirm</Chip>
            {missing && <span className="text-xs text-muted">&ldquo;{missing}&rdquo; not found</span>}
          </p>
        )}
      </div>
      <div className="col-start-2 space-y-2 md:col-start-3">
        {kept ? (
          <Kept row={row} sameAs={sameAs} />
        ) : row.replacement ? (
          <Proposal item={row.replacement} label="Proposed" gloss={gloss} />
        ) : (
          <p className="gn-noswap pt-0.5 text-sm text-muted">No local swap · budget moves to the memo</p>
        )}
        {row.alongside && <Proposal item={row.alongside} label="Added alongside" gloss={kept ? gloss : undefined} />}
      </div>
    </li>
  );
}

function NoSwapGroup({ rows }: { rows: { row: AuditRow; index: number }[] }) {
  const range = `${num(rows[0].index + 1)}–${num(rows[rows.length - 1].index + 1)}`;
  return (
    <li id={`line-${num(rows[0].index + 1)}`} tabIndex={-1} className="audit-row row-edge is-struck scroll-mt-24 border-b border-hairline py-4 last:border-b-0">
      <details className="group">
        <summary className="grid cursor-pointer grid-cols-[2rem_minmax(0,1fr)] gap-x-3 md:grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)] md:gap-x-6">
          <span className="whitespace-nowrap pt-0.5 font-mono text-xs tabular-nums text-muted">{range}</span>
          <span className="flex flex-wrap items-center gap-2 text-[15px] text-muted">
            {rows.length} lines struck
            <Chip tone="pen">No local swap</Chip>
            <span className="inline-flex items-center gap-1 text-xs group-hover:text-ink">
              <Chevron className="chev h-3 w-3" />
              Show
            </span>
          </span>
        </summary>
        <ol className="mt-3 space-y-2 border-l border-hairline pl-4 md:ml-[3.75rem]">
          {rows.map(({ row, index }) => (
            <li key={index} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 text-sm">
              <span className="font-mono text-xs tabular-nums text-muted">{num(index + 1)}</span>
              <span className="strike text-muted">{row.text}</span>
            </li>
          ))}
        </ol>
      </details>
    </li>
  );
}

type Segment = { kind: "row"; row: AuditRow; index: number } | { kind: "group"; rows: { row: AuditRow; index: number }[] };

// Consecutive struck items with no swap collapse into one line; the lines stay one click away.
function segment(audit: AuditRow[]): Segment[] {
  const out: Segment[] = [];
  let run: { row: AuditRow; index: number }[] = [];
  const flush = () => {
    if (run.length >= 2) out.push({ kind: "group", rows: run });
    else run.forEach((r) => out.push({ kind: "row", ...r }));
    run = [];
  };
  audit.forEach((row, index) => {
    if (!isKept(row.verdict) && !row.replacement) run.push({ row, index });
    else {
      flush();
      out.push({ kind: "row", row, index });
    }
  });
  flush();
  return out;
}

// The Qloo call log: every lookup behind the page (town, age groups, place traits, partner ages),
// quiet unless something failed. Never shows the API key or quota.
function QlooCalls({ calls }: { calls: TownRun["profile"]["calls"] }) {
  const failed = calls.filter((c) => !c.ok).length;
  return (
    <details id="qloo-calls" className="group no-print scroll-mt-24 text-xs">
      <summary className="inline-flex cursor-pointer items-center gap-1">
        <Chip tone={failed ? "warn" : "plain"}>
          Live Qloo data: {calls.length} lookups{failed ? ` · ${failed} failed` : ""}
        </Chip>
        <Chevron className="chev h-3 w-3" />
      </summary>
      <table className="ui-band-muted mt-2 w-full max-w-md text-left font-mono text-[11px]">
        <thead>
          <tr className="border-b border-band-text/15">
            <th className="py-1 pr-3 font-medium">Call</th>
            <th className="py-1 pr-3 text-right font-medium">Status</th>
            <th className="py-1 text-right font-medium">Results</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((c, i) => (
            <tr key={i} className={c.ok ? "" : "ui-band-alert"}>
              <td className="py-0.5 pr-3">{c.label}</td>
              <td className="py-0.5 pr-3 text-right tabular-nums">{c.status || "no answer"}</td>
              <td className="py-0.5 text-right tabular-nums">{c.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function TownView({ run }: { run: TownRun }) {
  const { town, profile, program, audit, source, qlooAdds, draft } = run;

  const kept = keptBreakdown(audit);
  const partnerPlaces = program.items.filter((it) => it.partner).length;
  const failed = profile.failedCalls.length;
  const comp = lineComposition(audit);
  // Each line's fragment id; lines folded into a "struck, no swap" group share the group's anchor.
  const anchors = audit.map((_, i) => `line-${num(i + 1)}`);
  for (const seg of segment(audit)) if (seg.kind === "group") for (const r of seg.rows) anchors[r.index] = `line-${num(seg.rows[0].index + 1)}`;
  // The struck lines' anchors in page order, once each (a no-swap group is one stop).
  const struckIds = [...new Set(audit.map((a, i) => (isKept(a.verdict) ? "" : anchors[i])).filter(Boolean))];
  const fund = fundSplit(program.items, program.unassigned);
  const partners = partnerPoints(program.items);
  const sessions = sessionsByBucket(program.items);

  const memoHref = `/memo/${town.slug}?fund=${program.annualFund}`;
  const planHref = (p: PlanSource) => `/town/${town.slug}?plan=${p}&fund=${program.annualFund}`;
  // Places and brands lead; a taste type whose local list is mostly national pop is marked as such.
  const tastes = (["brand", "artist", "tv_show", "podcast"] as const)
    .map((t) => ({ t, local: profile.strength[t].local, items: profile.taste[t].filter((s) => s.distinct).slice(0, 3) }))
    .filter((g) => g.items.length)
    .sort((a, b) => Number(b.local) - Number(a.local));
  // Kept lines that repeat an earlier line's partner say so instead of repeating its details.
  const firstLine = new Map<string, number>();
  const sameAs = audit.map((r, i) => {
    if (!isKept(r.verdict) || r.verdict === "mechanism") return undefined;
    const key = (r.matched?.name ?? r.named ?? "").toLowerCase();
    if (!key) return undefined;
    if (firstLine.has(key)) return num(firstLine.get(key)! + 1);
    firstLine.set(key, i);
    return undefined;
  });
  // The first "#N local affinity" chip on the page carries a one-time gloss inside its "Why".
  const glossIndex = audit.findIndex((r) => LOCAL_AFFINITY.test((r.replacement ?? r.alongside)?.provenance[0]?.signal ?? ""));
  const glossRank = glossIndex >= 0 ? (audit[glossIndex].replacement ?? audit[glossIndex].alongside)!.provenance[0].signal.match(/#(\d+)/)?.[1] : undefined;
  const gloss = glossRank ? `#${glossRank} of ${profile.placeCount} places within 15 km, ranked by Qloo for how strongly locals favour them.` : undefined;
  // The "Place traits" row shows when Qloo answered with traits, or says it couldn't check.
  const hasTraitsRow = !!profile.areaTags?.length || !!profile.areaTagCalls?.some((c) => !c.ok);
  const topPlaces = [...profile.localPlaces]
    .map((p) => ({ p, meta: profile.placeMeta.get(p.id) }))
    .sort((a, b) => (a.meta?.affinityRank ?? 1e6) - (b.meta?.affinityRank ?? 1e6))
    .slice(0, 5);

  const fundForm = (
    <form className="no-print ui-fund" action={`/town/${town.slug}`}>
      <input type="hidden" name="plan" value={source} />
      <label>
        Annual community fund (USD)
        <span className="ui-fund-input">
          <span aria-hidden>$</span>
          <input
            name="fund"
            type="text"
            inputMode="numeric"
            pattern="[0-9,]*"
            autoComplete="off"
            defaultValue={program.annualFund.toLocaleString("en-US")}
            aria-describedby="fund-hint"
          />
        </span>
      </label>
      <button>Recost</button>
      <SplitCta href={memoHref} className="ui-band-cta">
        Open the memo
      </SplitCta>
      <span id="fund-hint" className="sr-only">
        Whole dollars per year; commas are fine.
      </span>
    </form>
  );

  return (
    <main id="main">
      <PageBand
        titleId="town-title"
        kicker={`${FACILITY_LABEL[town.facility]} host community`}
        title={`${town.name}, ${town.region}`}
        aside={fundForm}
        visual={<TownSchematic lat={town.lat} lon={town.lon} facility={FACILITY_LABEL[town.facility]} points={partners} />}
      >
        <p className="ui-band-note">{town.custom ? "Entered by you" : town.project}</p>
        {!town.custom && (
          <div className="ui-band-meta">
            <Chip tone="warn">{town.fundNote.startsWith("Illustrative") ? "Illustrative fund" : "Reported fund"}</Chip>
          </div>
        )}
        {failed > 0 && (
          <p role="status" className="ui-band-note">
            <span className="ui-band-alert font-semibold">Qloo didn&apos;t answer ({failed} of {profile.calls.length} calls); this is not thin data.</span>{" "}
            <a href={planHref(source)}>Try again</a>: what loaded is kept, so a retry only asks for the rest.
          </p>
        )}
        {profile.thin && (
          <p role="note" className="ui-band-note">
            <span className="ui-band-warn font-semibold">Limited local data:</span> {profile.localPlaces.length} places within 15 km; add the partners residents name.{" "}
            <Link href="/proof#limits">Limits</Link>
          </p>
        )}
      </PageBand>

      <div className="ui-page">
        <section aria-label="Summary" className="ui-stats">
          <div className="ui-stat">
            <StruckTally comp={comp} draft={DRAFT[source].tab} anchorOf={(i) => anchors[i]} />
            <details className="ui-more">
              <summary>Details</summary>
              <div>
                {draftNote(run)}
                {kept.parts.length > 0 && <> Kept: {kept.parts.join(", ")}.</>}
              </div>
            </details>
          </div>
          <StatTile value={partnerPlaces} label="local partners Qloo found" tone="qloo" more={<>{qlooAdds.length} the draft never named. Each is traced to Qloo&apos;s taste data.</>}>
            {failed ? (
              <LiveDataNotice towns={[town.name]} subject="the partner list" reloadHref={planHref(source)} />
            ) : partners.length ? (
              <PartnerNames points={partners} />
            ) : (
              <p className="ui-note">None in Qloo&apos;s places within 15 km. Add the partners residents name.</p>
            )}
          </StatTile>
          <StatTile
            value={money(program.totalAllocated)}
            label="costed from the fund"
            more={
              <>
                {money(program.annualFund)} a year · {money(program.twoYearFund)} over 24 months. {town.fundNote}
              </>
            }
          >
            <p className="ui-stat-second">
              <span className="ui-stat-second-v">{money(program.unassigned)}</span> reserve
            </p>
          </StatTile>
          <div className="ui-provenance">
            <QlooCalls calls={[...profile.calls, ...(profile.lensCalls ?? []), ...(profile.areaTagCalls ?? []), ...(profile.ageCalls ?? [])]} />
          </div>
        </section>

        {/* The line-by-line check */}
        <Card as="section" aria-labelledby="audit-title" className="ui-section scroll-mt-24">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hairline px-5 pb-4 pt-5 sm:px-6">
            <div className="max-w-2xl">
              <h2 id="audit-title" className="ui-h3">
                The draft, checked line by line
              </h2>
              <p className="mt-1 text-xs text-muted">{draftNote(run)}</p>
              {draft.notice && (
                <p role="note" className="mt-2 flex gap-2 rounded-md bg-amber-wash px-3 py-2 text-sm">
                  <Notice className="mt-0.5 h-4 w-4 text-amber" />
                  <span>{draft.notice}</span>
                </p>
              )}
              {town.custom && source === "agency" && (
                <div className="no-print mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <Link href={planHref("llm")} prefetch={false} className={secondaryCta}>
                    {draft.notice ? "Try the live AI draft again" : "Have AI write a draft now"}
                  </Link>
                  <span className="text-xs text-muted">About 20 s, no Qloo data.</span>
                </div>
              )}
            </div>
            <nav aria-label="Draft plan to audit" className="no-print flex rounded-md bg-concrete p-0.5 text-sm shadow-[inset_0_0_0_1px_var(--hairline)]">
              {(["llm", "agency"] as const).map((p) => (
                <Link
                  key={p}
                  aria-current={source === p ? "page" : undefined}
                  href={planHref(p)}
                  prefetch={p === "llm" ? false : undefined}
                  className={`rounded px-3 py-1.5 transition-colors duration-150 ${
                    source === p ? "bg-paper font-medium text-ink shadow-sm" : "text-muted hover:text-ink active:bg-hairline"
                  }`}
                >
                  {DRAFT[p].tab}
                </Link>
              ))}
            </nav>
          </div>

          {audit.length > 0 && (
            <AuditTools counts={{ all: audit.length, generic: comp.generic, unsure: comp.unverified, kept: kept.total }} struckIds={struckIds}>
              {/* The verdict definitions, a click away beside the options */}
              <details className="audit-legend group text-xs text-muted">
                <summary className="audit-info" title="What do these mean?">
                  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                    <circle cx="8" cy="8" r="6.5" />
                    <path d="M8 7v4.5M8 4.6v.1" />
                  </svg>
                  <span className="sr-only">What do these mean?</span>
                </summary>
                <dl className="mt-3 grid gap-x-6 gap-y-2 md:grid-cols-3">
                  <div>
                    <dt className="font-medium text-ink">Not local</dt>
                    <dd>Names no local partner and matches nothing this town stands out for.</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-ink">Can&apos;t confirm</dt>
                    <dd>Names a partner that isn&apos;t an institution and isn&apos;t found in Qloo or OpenStreetMap. It may exist; it can&apos;t be checked here.</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-ink">Kept</dt>
                    <dd>
                      A verified local partner, something the town stands out for, an institution we can&apos;t check here (for the committee to confirm), or a
                      commitment kept as drafted.
                    </dd>
                  </div>
                </dl>
              </details>
            </AuditTools>
          )}

          {audit.length ? (
            <ol
              id="audit-lines"
              className="group/audit px-5 data-[filter=kept]:[&>li.is-struck]:hidden data-[filter=generic]:[&>li.is-kept]:hidden data-[filter=generic]:[&>li.is-unsure]:hidden data-[filter=unsure]:[&>li:not(.is-unsure)]:hidden sm:px-6"
            >
              {segment(audit).map((seg) =>
                seg.kind === "row" ? (
                  <AuditLine key={seg.index} row={seg.row} index={seg.index} sameAs={sameAs[seg.index]} gloss={seg.index === glossIndex ? gloss : undefined} />
                ) : (
                  <NoSwapGroup key={`g${seg.rows[0].index}`} rows={seg.rows} />
                ),
              )}
            </ol>
          ) : (
            <p className="px-6 py-10 text-center text-sm text-muted">This draft has no items to audit.</p>
          )}

          <div className="no-print flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-concrete/50 px-5 py-4 sm:px-6">
            <p className="ui-note">Amounts come from your fund, never from Qloo.</p>
            <SplitCta href={memoHref}>Open the memo</SplitCta>
          </div>
        </Card>

        {/* The fund and the partners, as charts */}
        <section aria-label="Fund and partners" className={`ui-section grid items-start gap-6 ${failed > 0 || partners.length > 0 ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : ""}`}>
          <Card className="px-5 py-5 sm:px-6">
            <h2 className="ui-h3">Where the fund goes</h2>
            <p className="mt-1 font-mono text-xs tabular-nums text-muted">{money(fund.total)} over 24 months</p>
            <div className="mt-5">
              <FundBar parts={fund.parts} total={fund.total} caption={`The ${money(fund.total)} 24-month fund by program area`} />
            </div>
            {sessions.length > 0 && (
              <div className="mt-6 border-t border-hairline pt-5">
                <h3 className="text-sm font-semibold">When it happens</h3>
                <div className="mt-3">
                  <SessionTimeline rows={sessions} />
                </div>
              </div>
            )}
          </Card>
          {(failed > 0 || partners.length > 0) && (
            <Card className="px-5 py-5 sm:px-6">
              <h2 className="ui-h3">Local partners, by distance</h2>
              <p className="mt-1 font-mono text-xs text-muted">Dot: distance from the site · #: Qloo local affinity rank · hollow: no rank</p>
              <div className="mt-4">
                {failed ? (
                  <LiveDataNotice towns={[town.name]} subject="the partner list" reloadHref={planHref(source)} />
                ) : (
                  <PartnerDistance points={partners} />
                )}
              </div>
            </Card>
          )}
        </section>

        {/* More local partners */}
        <section aria-labelledby="adds-title" className="ui-section qloo-band scroll-mt-24">
          <SectionHeader id="adds-title" size="sm" title="Qloo also suggests" lede={`${plural(qlooAdds.length, "local partner", "local partners")} the draft never named`} />
          {qlooAdds.length ? (
            <ul className="ui-card divide-y divide-hairline">
              {qlooAdds.map((it) => (
                <li key={it.id} className="row-edge is-kept grid gap-2 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6">
                  <div className="min-w-0">
                    <p className="font-medium leading-snug">
                      {kindOf(it.title)}
                      {it.partner && <span> · {shortOrg(it.partner.name)}</span>}
                    </p>
                    <p className="font-mono text-xs tabular-nums text-muted">
                      {[BUCKETS[it.bucket].label, km(it.partner?.distanceKm), money(it.amount)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Why item={it} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="ui-note">No further local partners. With limited local data, add places residents name.</p>
          )}
        </section>

        <AudienceReach reach={program.reach} className="ui-section" />

        {/* What the town favours, and the guardrails in one line */}
        <section aria-labelledby="favours-title" className="ui-section">
          <SectionHeader id="favours-title" size="sm" title={`What ${town.name} favours`} lede="Qloo taste data, aggregate for the town" />
          <div className="taste-panel lp-grain">
            {topPlaces.length > 0 && (
              <ol className="taste-places" aria-label="Places locals favour most, by Qloo affinity rank">
                {topPlaces.map(({ p, meta }) => (
                  <li key={p.id}>
                    {meta?.affinityRank ? <span className="taste-rank">#{meta.affinityRank}</span> : <span className="taste-rank is-none">by distance</span>}
                    <span className="taste-name">{p.name.split(" | ")[0]}</span>
                  </li>
                ))}
              </ol>
            )}
            {(tastes.length > 0 || hasTraitsRow) && (
              <dl className="taste-types">
                <PlaceTraits tags={profile.areaTags} calls={profile.areaTagCalls} />
                {tastes.map(({ t, items, local }) => (
                  <div key={t} className={local ? "is-local" : "is-national"}>
                    <dt>{TASTE_LABEL[t]}</dt>
                    <dd>
                      {items.map((sig) => (
                        <span key={sig.entity.id} className="taste-chip">
                          {sig.entity.name}
                        </span>
                      ))}
                      {!local && <span className="taste-flag">leans national, not used</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {!tastes.length && !topPlaces.length && !hasTraitsRow && <p className="text-sm">Nothing stands out locally for {town.name}.</p>}
          </div>
          <p className="ui-note mt-4">
            Guardrails: not tied to any vote or permit · residents rank · no political, religious or identity targeting ({profile.excluded.length} excluded by
            rule) · the sponsor is named on every message. <Link href="/sources#data">Sources</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
