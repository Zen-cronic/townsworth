import Link from "next/link";
import { money, type PlanSource, type TownRun } from "@/lib/run";
import { BASELINE } from "@/lib/baselineData";
import { BUCKETS, type ProgramItem } from "@/lib/plan";
import type { AuditRow } from "@/lib/audit";
import { Check, Chevron, Notice } from "@/components/dashboard/Icons";
import { ProvenanceChip } from "@/components/dashboard/ProvenanceChip";
import { Figure } from "@/components/dashboard/Figure";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { primaryCta, secondaryCta } from "@/components/dashboard/ui";
import { cadenceLower, formatPhone, km, quotedName } from "@/components/dashboard/format";

const FACILITY_LABEL: Record<string, string> = {
  "data center": "Data center",
  fab: "Chip fab",
  nuclear: "Nuclear plant",
  plant: "Plant",
};

const DRAFT: Record<PlanSource, { tab: string; note: string }> = {
  llm: {
    tab: "Plain-LLM draft",
    note: `Written by OpenAI ${BASELINE.model} with no Qloo access, and frozen before it was measured.`,
  },
  agency: {
    tab: "Agency template",
    note: "A sample of the generic plan a consultancy might send to any town.",
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
  if (town.custom && source === "agency") return "No frozen LLM plan for this town; auditing the typical agency template.";
  return DRAFT[source].note;
}

const TASTE_LABEL = { brand: "Brands", artist: "Artists", tv_show: "TV", podcast: "Podcasts" } as const;

const pad2 = (n: number) => String(n).padStart(2, "0");

// One card shell for every margin note; the tone changes, the shape doesn't.
const SHELL = {
  kept: "rounded-md border border-hairline bg-paper px-3.5 py-3",
  proposed: "slide-in rounded-md border border-ok/30 border-l-[3px] border-l-ok bg-paper px-3.5 py-3 shadow-[0_1px_2px_rgb(34_33_31/0.05)]",
  none: "rounded-md border border-dashed border-rule px-3.5 py-3",
};

function Eyebrow({ tone, children }: { tone: "ok" | "muted"; children: React.ReactNode }) {
  return (
    <p className={`flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider ${tone === "ok" ? "text-ok-text" : "text-muted"}`}>
      {children}
    </p>
  );
}

function PartnerFacts({ item }: { item: ProgramItem }) {
  const p = item.partner;
  if (!p) return null;
  const facts = [
    km(p.distanceKm) && `${km(p.distanceKm)} from site`,
    p.rating != null && `Rated ${p.rating.toFixed(1)}`,
    p.eventSpaces && "Event space",
    formatPhone(p.phone),
  ].filter(Boolean) as string[];
  if (!facts.length) return null;
  return (
    <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
      {facts.map((f, i) => (
        <span key={f} className="whitespace-nowrap">
          {i > 0 && <span aria-hidden className="mr-2 text-rule">·</span>}
          {f}
        </span>
      ))}
    </p>
  );
}

function Proposal({ item, delay }: { item: ProgramItem; delay: number }) {
  const bucket = BUCKETS[item.bucket];
  return (
    <div className={SHELL.proposed} style={{ animationDelay: `${delay}ms` }}>
      <Eyebrow tone="ok">
        Proposed <span className="font-normal normal-case tracking-normal text-muted">· {bucket.label}</span>
      </Eyebrow>
      {/* Tier 1: what and where */}
      <p className="mt-1 text-[15px] font-medium leading-snug">{item.title}</p>
      <PartnerFacts item={item} />
      {/* Tier 2: budget and cadence */}
      <p className="mt-2 flex flex-wrap items-baseline gap-x-1.5 text-xs text-muted">
        <span className="font-mono text-sm tabular-nums text-ink">{money(item.amount)}</span>
        <span>item budget from your fund · {cadenceLower(bucket.cadence)}</span>
      </p>
      {/* Tier 3: evidence */}
      <div className="mt-2.5">
        <ProvenanceChip item={item} />
      </div>
    </div>
  );
}

function Kept({ row }: { row: AuditRow }) {
  return (
    <div className={SHELL.kept}>
      <Eyebrow tone="ok">
        <Check className="h-3 w-3" />
        Kept
      </Eyebrow>
      <p className="mt-1 text-[15px] leading-snug">{row.matched?.name ?? "Matches a local signal"}</p>
      <p className="mt-0.5 text-xs text-muted">
        {row.matched
          ? [row.matched.source === "osm" ? "Verified on OpenStreetMap" : "In Qloo's local data", km(row.matched.distanceKm) && `${km(row.matched.distanceKm)} away`]
              .filter(Boolean)
              .join(" · ")
          : row.termHits[0]}
      </p>
    </div>
  );
}

function NoSwap({ plural }: { plural?: boolean }) {
  return (
    <div className={SHELL.none}>
      <Eyebrow tone="muted">No local swap</Eyebrow>
      <p className="mt-1 text-[15px] leading-snug text-muted">
        {plural ? "Their budget moves" : "This budget moves"} into the memo program.
      </p>
    </div>
  );
}

const ROW = "grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-3 border-b border-hairline py-4 last:border-b-0 md:grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)] md:gap-x-6";

function AuditLine({ row, index }: { row: AuditRow; index: number }) {
  const kept = row.verdict === "grounded";
  const missing = row.verdict === "unverified" ? quotedName(row.reasons[0]) : undefined;
  const delay = index * 70;

  return (
    <li className={ROW}>
      <span className="pt-0.5 font-mono text-xs tabular-nums text-muted">{pad2(index + 1)}</span>
      <div>
        <p className={`text-[15px] leading-relaxed ${kept ? "text-ink" : "text-muted"}`}>
          <span className={kept ? "" : "strike"} style={kept ? undefined : { animationDelay: `${delay}ms` }}>
            {row.text}
          </span>
        </p>
        {!kept && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <StatusPill tone="flag">{row.verdict === "unverified" ? "Unverified" : "Generic"}</StatusPill>
            {missing && <span className="text-xs text-muted">&ldquo;{missing}&rdquo; not found locally</span>}
          </div>
        )}
      </div>
      <div className="col-start-2 md:col-start-3">
        {kept ? <Kept row={row} /> : row.replacement ? <Proposal item={row.replacement} delay={delay + 260} /> : <NoSwap />}
      </div>
    </li>
  );
}

function NoSwapGroup({ rows }: { rows: { row: AuditRow; index: number }[] }) {
  const range = `${pad2(rows[0].index + 1)}–${pad2(rows[rows.length - 1].index + 1)}`;
  const unverified = rows.filter((r) => r.row.verdict === "unverified").length;
  return (
    <li className="border-b border-hairline py-4 last:border-b-0">
      <details className="group">
        <summary className="grid cursor-pointer grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-3 md:grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)] md:gap-x-6">
          <span className="whitespace-nowrap pt-0.5 font-mono text-xs tabular-nums text-muted">{range}</span>
          <span>
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] text-muted">{rows.length} struck items</span>
              {unverified > 0 && <StatusPill tone="flag">{unverified} Unverified</StatusPill>}
              {rows.length - unverified > 0 && <StatusPill tone="flag">{rows.length - unverified} Generic</StatusPill>}
            </span>
            <span className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted group-hover:text-ink">
              <Chevron className="chev h-3 w-3" />
              Show the {rows.length} lines
            </span>
          </span>
          <span className="col-start-2 md:col-start-3">
            <NoSwap plural />
          </span>
        </summary>
        <ol className="mt-3 space-y-3 border-l-2 border-hairline pl-4 md:ml-[3.75rem]">
          {rows.map(({ row, index }) => {
            const missing = row.verdict === "unverified" ? quotedName(row.reasons[0]) : undefined;
            return (
              <li key={index} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 text-sm">
                <span className="font-mono text-xs tabular-nums text-muted">{pad2(index + 1)}</span>
                <span>
                  <span className="strike text-muted">{row.text}</span>
                  {missing && <span className="mt-0.5 block text-xs text-muted">&ldquo;{missing}&rdquo; not found locally</span>}
                </span>
              </li>
            );
          })}
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
    if (row.verdict !== "grounded" && !row.replacement) run.push({ row, index });
    else {
      flush();
      out.push({ kind: "row", row, index });
    }
  });
  flush();
  return out;
}

function Story({
  step,
  title,
  figure,
  tone,
  wide,
  children,
}: {
  step: string;
  title: string;
  figure: string;
  tone?: "flag";
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col bg-paper px-4 py-3.5 sm:px-6 sm:py-5 ${wide ? "sm:col-span-2 md:col-span-1" : ""}`}>
      <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
        {step} · {title}
      </p>
      <p className={`mt-2 text-[1.625rem] leading-none sm:mt-3 sm:text-[2rem] ${tone === "flag" ? "text-hivis-text" : "text-ink"}`}>
        <Figure value={figure} />
      </p>
      <div className="mt-2 flex flex-1 flex-col text-sm leading-snug text-muted">{children}</div>
    </div>
  );
}

function SectionHead({ id, title, note, children }: { id?: string; title: string; note?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule px-5 py-4 sm:px-6">
      <div className="max-w-2xl">
        <h2 id={id} className="font-semibold tracking-tight">
          {title}
        </h2>
        {note && <p className="mt-0.5 text-sm text-muted">{note}</p>}
      </div>
      {children}
    </div>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function TownView({ run }: { run: TownRun }) {
  const { town, profile, program, audit, source, qlooAdds, draft } = run;

  // Counts, each with the unit it measures (see the legend under the summary).
  const flagged = audit.filter((a) => a.verdict !== "grounded").length;
  const keptPartners = audit.filter((a) => a.verdict === "grounded" && a.matched).length;
  const keptSignals = audit.filter((a) => a.verdict === "grounded" && !a.matched).length;
  const partnerPlaces = program.items.filter((it) => it.partner).length;
  const swapPlaces = audit.filter((a) => a.replacement?.partner).length;
  const draftAlsoNamed = Math.max(0, partnerPlaces - swapPlaces - qlooAdds.length);
  const llmDraft = "the draft";

  const memoHref = `/memo/${town.slug}?fund=${program.annualFund}`;
  const planHref = (p: PlanSource) => `/town/${town.slug}?plan=${p}&fund=${program.annualFund}`;
  const exampleIndex = audit.findIndex((a) => a.verdict !== "grounded" && a.replacement);
  const example = exampleIndex >= 0 ? audit[exampleIndex] : undefined;
  const tastes = (["brand", "artist", "tv_show", "podcast"] as const)
    .map((t) => ({ t, items: profile.taste[t].filter((s) => s.distinct).slice(0, t === "brand" ? 4 : 3) }))
    .filter((g) => g.items.length);

  return (
    <main className="mx-auto max-w-[1200px] px-4 pb-24 pt-5 sm:px-6 sm:pt-8">
      {/* Summary header: phones read title, story, CTA, then the fund control */}
      <section aria-labelledby="town-title" className="grid gap-y-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-x-8 md:gap-y-5">
        <div className="order-1 min-w-0 max-w-3xl">
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
            <span className="font-medium text-ink">{FACILITY_LABEL[town.facility]} host community</span>
            {town.custom ? (
              <StatusPill tone="neutral">Entered by you</StatusPill>
            ) : (
              <>
                <span aria-hidden className="hidden text-rule sm:inline">/</span>
                <span className="hidden sm:inline">{town.project}</span>
              </>
            )}
          </p>
          <h1 id="town-title" className="mt-1 text-[1.75rem] font-semibold leading-tight tracking-tight md:text-[2.5rem]">
            {town.name}, {town.region}
          </h1>
          {!town.custom && <p className="mt-1 text-sm text-muted sm:hidden">{town.project}</p>}
        </div>

        <form className="no-print order-4 flex items-end gap-2 text-sm md:order-2" action={`/town/${town.slug}`}>
          <input type="hidden" name="plan" value={source} />
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Annual community fund (USD)</span>
            <span className="flex items-center rounded-md border border-rule bg-paper pl-3 transition-colors duration-150 focus-within:border-ink hover:border-ink/50">
              <span aria-hidden className="font-mono text-muted">$</span>
              <input
                name="fund"
                type="text"
                inputMode="numeric"
                pattern="[0-9,]*"
                autoComplete="off"
                defaultValue={program.annualFund.toLocaleString("en-US")}
                aria-describedby="fund-hint"
                className="w-32 bg-transparent px-2 py-2 font-mono tabular-nums focus:outline-none focus-visible:outline-none"
              />
            </span>
          </label>
          <button className="rounded-md border border-rule bg-paper px-3 py-2 font-medium transition-colors duration-150 hover:border-ink active:bg-concrete">
            Re-plan
          </button>
          <span id="fund-hint" className="sr-only">
            Whole dollars per year; commas are fine.
          </span>
        </form>

        {profile.thin && (
          <div role="note" className="order-2 flex gap-3 rounded-md border border-amber/35 bg-amber-wash px-4 py-3 text-sm md:order-3 md:col-span-2">
            <Notice className="mt-0.5 h-4 w-4 text-amber" />
            <p>
              <span className="font-semibold">Thin data.</span> Qloo has few local signals near {town.name} ({profile.localPlaces.length}{" "}
              independent {profile.localPlaces.length === 1 ? "place" : "places"} within 15 km). The plan is shorter on purpose: treat it as a
              starting list and add the partners residents name.
            </p>
          </div>
        )}

        <div className="order-3 grid gap-px overflow-hidden rounded-lg border border-rule bg-hairline sm:grid-cols-2 md:order-4 md:col-span-2 md:grid-cols-3">
          <Story step="01" title="What the draft got wrong" figure={`${flagged} of ${audit.length}`} tone="flag">
            <p>draft items struck: they name nothing local, or a partner that can&apos;t be found.</p>
            <p className="mt-auto pt-2.5 text-xs">
              <span className="font-mono tabular-nums text-ok-text">{audit.length - flagged}</span> kept:{" "}
              {plural(keptPartners, "verified local partner", "verified local partners")}
              {keptSignals > 0 && `, ${plural(keptSignals, "local-signal match", "local-signal matches")}`}
            </p>
          </Story>
          <Story step="02" title="What Qloo adds" figure={String(partnerPlaces)}>
            <p>local partner places in the program, each traced to a Qloo signal.</p>
            <p className="mt-auto pt-2.5 text-xs">
              <span className="font-mono tabular-nums text-ink">{swapPlaces}</span> swap into struck lines ·{" "}
              <span className="font-mono tabular-nums text-ink">{qlooAdds.length}</span> more {llmDraft} never named
              {draftAlsoNamed > 0 && (
                <>
                  {" "}
                  · <span className="font-mono tabular-nums text-ink">{draftAlsoNamed}</span> {llmDraft} also named
                </>
              )}
            </p>
          </Story>
          <Story step="03" title="The commitments memo" figure={money(program.totalAllocated)} wide>
            <p>
              in item budgets over 24 months across {plural(program.items.length, "program item", "program items")}, drawn from your fund.
            </p>
            <div className="no-print mt-auto pt-3">
              <Link href={memoHref} className={primaryCta}>
                Open the commitments memo
                <Chevron className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Story>
          {example?.replacement && (
            <div className="hidden gap-x-4 gap-y-2 bg-concrete px-4 py-3 text-sm sm:col-span-2 sm:grid sm:px-6 md:col-span-3 md:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted">Line {pad2(exampleIndex + 1)}</span>
              <span className="truncate text-muted">
                <span className="strike">{example.text}</span>
              </span>
              <Chevron className="hidden h-3.5 w-3.5 text-muted md:block" />
              <span className="flex min-w-0 items-center gap-2">
                <Check className="h-3.5 w-3.5 text-ok" />
                <span className="truncate font-medium">{example.replacement.title}</span>
                <span className="hidden shrink-0 font-mono text-xs text-muted xl:inline">{example.replacement.provenance[0]?.signal}</span>
              </span>
            </div>
          )}
        </div>
      </section>

      {/* The audit document */}
      <section aria-labelledby="audit-title" className="doc-sheet mt-8 scroll-mt-24 rounded-lg">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-rule px-5 pb-4 pt-5 sm:px-6">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted">Plan audit · {audit.length} draft items</p>
            <h2 id="audit-title" className="mt-1 text-lg font-semibold tracking-tight">
              The draft, red-penned against {town.name}
            </h2>
            <p className="mt-1 text-sm text-muted">{draftNote(run)}</p>
            {draft.notice && (
              <p role="note" className="mt-2 flex gap-2 rounded-md border border-amber/35 bg-amber-wash px-3 py-2 text-sm">
                <Notice className="mt-0.5 h-4 w-4 text-amber" />
                <span>{draft.notice}</span>
              </p>
            )}
            {town.custom && source === "agency" && (
              <div className="no-print mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <Link href={planHref("llm")} className={secondaryCta}>
                  {draft.notice ? "Try the live LLM draft again" : "Have a plain LLM draft it now"}
                </Link>
                <span className="text-xs text-muted">About 20 s. OpenAI writes it with no Qloo access; each named partner is checked on OpenStreetMap.</span>
              </div>
            )}
          </div>
          <div role="tablist" aria-label="Draft plan to audit" className="no-print flex rounded-md border border-rule bg-concrete p-0.5 text-sm">
            {(["llm", "agency"] as const).map((p) => (
              <Link
                key={p}
                role="tab"
                aria-selected={source === p}
                href={planHref(p)}
                className={`rounded px-3 py-1.5 transition-colors duration-150 ${
                  source === p ? "bg-paper font-medium text-ink shadow-sm" : "text-muted hover:text-ink active:bg-hairline"
                }`}
              >
                {DRAFT[p].tab}
              </Link>
            ))}
          </div>
        </div>

        <dl className="grid gap-x-6 gap-y-2 border-b border-hairline bg-concrete/50 px-5 py-3 text-xs text-muted sm:px-6 md:grid-cols-3">
          <div className="flex items-start gap-2">
            <dt>
              <StatusPill tone="flag">Generic</StatusPill>
            </dt>
            <dd className="pt-0.5">Names no local partner and matches nothing this town distinctly over-indexes on.</dd>
          </div>
          <div className="flex items-start gap-2">
            <dt>
              <StatusPill tone="flag">Unverified</StatusPill>
            </dt>
            <dd className="pt-0.5">Names a partner not found in Qloo or OpenStreetMap. It may exist; it can&apos;t be checked here.</dd>
          </div>
          <div className="flex items-start gap-2">
            <dt className="flex items-center gap-1 pt-0.5 font-medium text-ok-text">
              <Check className="h-3.5 w-3.5" />
              Kept
            </dt>
            <dd className="pt-0.5">
              Names a real local partner, or matches a distinct local signal. Struck items with no like-for-like local partner move their budget
              into the memo program.
            </dd>
          </div>
        </dl>

        <div className="hidden grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)] gap-x-6 border-b border-hairline px-6 py-2 text-[11px] font-medium uppercase tracking-wider text-muted md:grid">
          <span>#</span>
          <span>Draft item</span>
          <span>Good Neighbor</span>
        </div>

        {audit.length ? (
          <ol className="px-5 sm:px-6">
            {segment(audit).map((seg) =>
              seg.kind === "row" ? (
                <AuditLine key={seg.index} row={seg.row} index={seg.index} />
              ) : (
                <NoSwapGroup key={`g${seg.rows[0].index}`} rows={seg.rows} />
              ),
            )}
          </ol>
        ) : (
          <p className="px-6 py-10 text-center text-sm text-muted">This draft has no items to audit.</p>
        )}

        <div className="no-print flex flex-wrap items-center justify-between gap-3 border-t border-rule bg-concrete/50 px-5 py-4 sm:px-6">
          <p className="max-w-xl text-xs text-muted">
            Amounts are item budgets drawn from your fund, never from Qloo. Qloo supplies the partners and the signals behind them.
          </p>
          <Link href={memoHref} className={primaryCta}>
            Open the commitments memo
            <Chevron className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {/* What Qloo adds */}
      <section aria-labelledby="adds-title" className="mt-8 scroll-mt-24 rounded-lg border border-rule bg-paper">
        <SectionHead
          id="adds-title"
          title="What Qloo adds"
          note={`Beyond the swaps above: more places residents go that ${llmDraft} never mentions. Open a row for the Qloo signal.`}
        >
          <p className="font-mono text-xs tabular-nums text-muted">{plural(qlooAdds.length, "more partner place", "more partner places")}</p>
        </SectionHead>
        {qlooAdds.length ? (
          <>
            <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_5rem_4.5rem_8rem_1rem] gap-x-4 border-b border-hairline px-6 py-2 text-[11px] font-medium uppercase tracking-wider text-muted lg:grid">
              <span>Program item</span>
              <span>Area</span>
              <span className="text-right">Distance</span>
              <span className="text-right">Rating</span>
              <span className="text-right">Item budget</span>
              <span />
            </div>
            <ul className="divide-y divide-hairline">
              {qlooAdds.map((it) => (
                <li key={it.id}>
                  <details className="group">
                    <summary className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-5 py-3 transition-colors duration-150 hover:bg-concrete/60 sm:px-6 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_5rem_4.5rem_8rem_1rem] lg:items-center">
                      <span className="min-w-0">
                        <span className="block font-medium leading-snug">{it.title}</span>
                        <span className="block text-xs text-muted">
                          {[it.partner?.eventSpaces && "Event space", formatPhone(it.partner?.phone)].filter(Boolean).join(" · ") || it.detail}
                        </span>
                      </span>
                      <span className="order-3 col-span-2 text-xs text-muted lg:order-none lg:col-span-1 lg:text-sm">
                        {BUCKETS[it.bucket].label}
                        <span className="lg:hidden">
                          {km(it.partner?.distanceKm) && ` · ${km(it.partner?.distanceKm)}`}
                          {it.partner?.rating != null && ` · Rated ${it.partner.rating.toFixed(1)}`}
                        </span>
                      </span>
                      <span className="hidden text-right font-mono text-sm tabular-nums text-muted lg:block">{km(it.partner?.distanceKm) ?? "—"}</span>
                      <span className="hidden text-right font-mono text-sm tabular-nums text-muted lg:block">{it.partner?.rating?.toFixed(1) ?? "—"}</span>
                      <span className="text-right font-mono text-sm tabular-nums">{money(it.amount)}</span>
                      <Chevron className="chev hidden h-3.5 w-3.5 text-muted lg:block" />
                    </summary>
                    <div className="border-t border-hairline bg-concrete/50 px-5 py-3 text-xs text-muted sm:px-6">
                      <ul className="space-y-1 border-l-2 border-ok/40 pl-3 leading-relaxed">
                        {it.provenance.map((p, i) => (
                          <li key={i}>
                            <span className="font-mono text-ink">{p.signal}</span>: {p.detail}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2">Item budget from your fund · {cadenceLower(BUCKETS[it.bucket].cadence)}</p>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="px-6 py-8 text-sm text-muted">
            No further partner places for {town.name} beyond the swaps above. With thin local data, the committee should add places residents name.
          </p>
        )}
      </section>

      {/* Signals and guardrails */}
      <section className="mt-8 grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <div className="rounded-lg border border-rule bg-paper">
          <SectionHead
            title={`What ${town.name} over-indexes on`}
            note="Aggregate Qloo affinities near the site that are not in the national top 20 or the big-metro lists. Themes, not profiles of people."
          />
          {tastes.length ? (
            <dl className="divide-y divide-hairline px-5 sm:px-6">
              {tastes.map(({ t, items }) => (
                <div key={t} className="grid gap-2 py-3 sm:grid-cols-[6rem_1fr] sm:items-baseline">
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted">{TASTE_LABEL[t]}</dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {items.map((s) => (
                      <span key={s.entity.id} className="rounded-full border border-hairline bg-concrete px-2.5 py-0.5 text-sm">
                        {s.entity.name}
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="px-6 py-6 text-sm text-muted">Qloo returned no distinctly local affinities for {town.name}.</p>
          )}
        </div>
        <div className="rounded-lg border border-rule bg-paper">
          <SectionHead title="Guardrails" />
          <ul className="space-y-2.5 px-5 py-4 text-sm sm:px-6">
            {[
              "Not persuasion: nothing here is scheduled around a vote, hearing or permit.",
              "Residents rank the shortlist; the community committee decides.",
              `No political, religious or identity targeting. ${profile.excluded.length} ${profile.excluded.length === 1 ? "result was" : "results were"} excluded by rule.`,
              "Every message carries the sponsor's name. Signals are aggregate, never individual.",
            ].map((g) => (
              <li key={g} className="flex gap-2.5">
                <Check className="mt-1 h-3.5 w-3.5 text-ok" />
                <span className="text-muted">{g}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
