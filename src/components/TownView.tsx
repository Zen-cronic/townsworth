import Link from "next/link";
import { money, type PlanSource, type TownRun } from "@/lib/run";
import { BASELINE } from "@/lib/baselineData";
import { BUCKETS, costLine, ROLE_LABEL, type ProgramItem } from "@/lib/plan";
import { isKept, type AuditRow } from "@/lib/audit";
import { Check, Chevron, Notice } from "@/components/dashboard/Icons";
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
    tab: "AI-written draft",
    note: `Written by OpenAI ${BASELINE.model} with no Qloo access, and frozen before it was measured.`,
  },
  agency: {
    tab: "Consultant template",
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
  if (town.custom && source === "agency") return "No frozen AI-written plan for this town; checking the typical consultant template.";
  return DRAFT[source].note;
}

const TASTE_LABEL = { brand: "Brands", artist: "Artists", tv_show: "TV", podcast: "Podcasts" } as const;

// Draft lines are referred to plainly ("Line 4"), and anchored as #line-4.
const num = (n: number) => String(n);

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
    p.neighbouring && `Neighbouring community${p.city ? ` (${p.city})` : ""}`,
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

// The signal in short form ("#6 local affinity"), with the full reasoning behind a separate "Why".
const shortSignal = (signal?: string) =>
  signal ? signal.replace(/^(?:Qloo place|Local favourite) · #(\d+) by local affinity$/, "#$1 local affinity").replace(/^Qloo /, "") : "Qloo signal";

function Signal({ item, gloss }: { item: ProgramItem; gloss?: string }) {
  return (
    <details className="group text-xs">
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="inline-flex items-center gap-1.5 rounded border border-hairline bg-concrete px-2 py-1 font-mono text-muted">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ok" />
          {shortSignal(item.provenance[0]?.signal)}
        </span>
        <span className="inline-flex items-center gap-0.5 font-medium text-ink underline decoration-rule underline-offset-2 transition-colors duration-150 group-hover:decoration-ink">
          Why
          <Chevron className="chev h-3 w-3" />
        </span>
      </summary>
      <ul className="mt-2 space-y-1 border-l-2 border-ok/40 pl-3 leading-relaxed text-muted">
        {item.provenance.map((p, i) => (
          <li key={i}>
            <span className="font-mono text-ink">{p.signal}</span>: {p.detail}
          </li>
        ))}
      </ul>
      {gloss && <p className="mt-1.5 leading-relaxed text-muted group-open:hidden">{gloss}</p>}
    </details>
  );
}

function Proposal({ item, delay, label = "Proposed", gloss }: { item: ProgramItem; delay: number; label?: string; gloss?: string }) {
  const bucket = BUCKETS[item.bucket];
  return (
    <div className={SHELL.proposed} style={{ animationDelay: `${delay}ms` }}>
      <Eyebrow tone="ok">
        {label} <span className="font-normal normal-case tracking-normal text-muted">· {bucket.label}</span>
      </Eyebrow>
      {/* Tier 1: what and where */}
      <p className="mt-1 text-[15px] font-medium leading-snug">{item.title}</p>
      <PartnerFacts item={item} />
      {/* Tier 2: who hosts, sessions x unit cost, cadence */}
      <p className="mt-2 text-xs text-muted">{costLine(item)}</p>
      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-xs text-muted">
        <span className="font-mono text-sm tabular-nums text-ink">{money(item.amount)}</span>
        <span>item budget from your fund · {cadenceLower(item.cadence)}</span>
      </p>
      {/* Tier 3: evidence */}
      <div className="mt-2.5">
        <Signal item={item} gloss={gloss} />
      </div>
    </div>
  );
}

// Kept lines are a single compact line: the check, the partner, how it was confirmed. No card.
function KeptLine({ name, children }: { name: string; children?: React.ReactNode }) {
  return (
    <div className="flex gap-2 pt-0.5 text-sm leading-snug">
      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" />
      <p>
        <span className="font-medium text-ok-text">Kept:</span> <span className="font-medium">{name}</span>
        {children}
      </p>
    </div>
  );
}

function Kept({ row, sameAs }: { row: AuditRow; sameAs?: string }) {
  if (row.verdict === "institution") {
    return (
      <KeptLine name={row.named ?? "Institution"}>
        <span className="text-muted"> · institution, couldn&apos;t verify here</span>
        <span className="mt-0.5 block text-xs text-muted">
          {sameAs ? `Same partner as line ${sameAs}. ` : "Not in Qloo's places or OpenStreetMap nearby. "}Confirm with the committee.
        </span>
      </KeptLine>
    );
  }
  if (row.verdict === "mechanism") {
    const names = (row.applicants ?? []).map((a) => a.partner?.name).filter(Boolean) as string[];
    return (
      <KeptLine name={row.keptLabel ?? "grant mechanism"}>
        <span className="text-muted"> · {row.keptNote ?? "how grants are decided stays as drafted"}</span>
        {names.length > 0 && (
          <span className="mt-0.5 block text-xs leading-relaxed text-muted">
            <span className="font-medium text-ink">Suggested applicants from Qloo:</span> {names.join(" · ")}
          </span>
        )}
      </KeptLine>
    );
  }
  const how = row.matched
    ? [row.matched.source === "osm" ? "verified on OpenStreetMap" : "a local place from Qloo, within 15 km", km(row.matched.distanceKm) && `${km(row.matched.distanceKm)} away`]
        .filter(Boolean)
        .join(" · ")
    : row.termHits[0];
  if (row.keptAs === "host") {
    return (
      <KeptLine name={row.keptLabel ?? "names the host community"}>
        <span className="text-muted"> · {row.keptNote ?? "a local commitment, kept as drafted"}</span>
      </KeptLine>
    );
  }
  return (
    <KeptLine name={row.matched?.name ?? "matches a local favourite"}>
      <span className="text-muted"> · {sameAs ? `same partner as line ${sameAs}` : how}</span>
    </KeptLine>
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

function AuditLine({ row, index, sameAs, gloss }: { row: AuditRow; index: number; sameAs?: string; gloss?: string }) {
  const kept = isKept(row.verdict);
  const missing = row.verdict === "unverified" ? quotedName(row.reasons[0]) : undefined;
  const delay = index * 70;

  return (
    <li id={`line-${num(index + 1)}`} className={`${ROW} scroll-mt-24`}>
      <span className="pt-0.5 font-mono text-xs tabular-nums text-muted">{num(index + 1)}</span>
      <div>
        <p className={`text-[15px] leading-relaxed ${kept ? "text-ink" : "text-muted"}`}>
          <span className={kept ? "" : "strike"} style={kept ? undefined : { animationDelay: `${delay}ms` }}>
            {row.text}
          </span>
        </p>
        {!kept && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <StatusPill tone="flag">{row.verdict === "unverified" ? "Can't confirm" : "Not local"}</StatusPill>
            {missing && <span className="text-xs text-muted">&ldquo;{missing}&rdquo; not found locally</span>}
          </div>
        )}
      </div>
      <div className="col-start-2 space-y-2 md:col-start-3">
        {kept ? <Kept row={row} sameAs={sameAs} /> : row.replacement ? <Proposal item={row.replacement} delay={delay + 260} gloss={gloss} /> : <NoSwap />}
        {row.alongside && <Proposal item={row.alongside} delay={delay + 260} label="Added alongside" gloss={kept ? gloss : undefined} />}
      </div>
    </li>
  );
}

function NoSwapGroup({ rows }: { rows: { row: AuditRow; index: number }[] }) {
  const range = `${num(rows[0].index + 1)}–${num(rows[rows.length - 1].index + 1)}`;
  const unverified = rows.filter((r) => r.row.verdict === "unverified").length;
  return (
    <li id={`line-${num(rows[0].index + 1)}`} className="scroll-mt-24 border-b border-hairline py-4 last:border-b-0">
      <details className="group">
        <summary className="grid cursor-pointer grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-3 md:grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)] md:gap-x-6">
          <span className="whitespace-nowrap pt-0.5 font-mono text-xs tabular-nums text-muted">{range}</span>
          <span>
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] text-muted">{rows.length} struck items</span>
              {unverified > 0 && <StatusPill tone="flag">{unverified} Can&apos;t confirm</StatusPill>}
              {rows.length - unverified > 0 && <StatusPill tone="flag">{rows.length - unverified} Not local</StatusPill>}
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
                <span className="font-mono text-xs tabular-nums text-muted">{num(index + 1)}</span>
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
    if (!isKept(row.verdict) && !row.replacement) run.push({ row, index });
    else {
      flush();
      out.push({ kind: "row", row, index });
    }
  });
  flush();
  return out;
}

function Story({
  title,
  figure,
  tone,
  wide,
  children,
}: {
  title: string;
  figure: string;
  tone?: "flag";
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col bg-paper px-4 py-3.5 sm:px-6 sm:py-5 ${wide ? "sm:col-span-2 md:col-span-1" : ""}`}>
      <p className="font-mono text-[11px] uppercase tracking-wider text-muted">{title}</p>
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

// The Qloo call log: quiet unless something failed. Never shows the API key or quota.
function QlooCalls({ calls }: { calls: TownRun["profile"]["calls"] }) {
  const failed = calls.filter((c) => !c.ok).length;
  return (
    <details id="qloo-calls" className="group no-print mt-2 scroll-mt-24 text-xs">
      <summary className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-hairline px-2 py-0.5 text-muted transition-colors duration-150 hover:border-rule hover:text-ink">
        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${failed ? "bg-hivis" : "bg-ok"}`} />
        <span className="font-mono">
          Qloo calls: {calls.length} · {failed ? `${failed} failed` : "all OK"}
        </span>
        <Chevron className="chev h-3 w-3" />
      </summary>
      <table className="mt-2 w-full max-w-md text-left font-mono text-[11px] text-muted">
        <thead>
          <tr className="border-b border-hairline">
            <th className="py-1 pr-3 font-medium">Call</th>
            <th className="py-1 pr-3 text-right font-medium">Status</th>
            <th className="py-1 text-right font-medium">Results</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((c, i) => (
            <tr key={i} className={c.ok ? "" : "text-hivis-text"}>
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

  // Counts, each with the unit it measures (see the legend under the summary).
  const flagged = audit.filter((a) => !isKept(a.verdict)).length;
  const keptPartners = audit.filter((a) => a.verdict === "grounded" && a.matched).length;
  const keptSignals = audit.filter((a) => a.verdict === "grounded" && !a.matched).length;
  const keptInstitutions = audit.filter((a) => a.verdict === "institution").length;
  const keptMechanisms = audit.filter((a) => a.verdict === "mechanism").length;
  const partnerPlaces = program.items.filter((it) => it.partner).length;
  const swapPlaces = audit.filter((a) => a.replacement?.partner).length;
  const alongsidePlaces = audit.filter((a) => a.alongside?.partner).length;
  const draftAlsoNamed = Math.max(0, partnerPlaces - swapPlaces - alongsidePlaces - qlooAdds.length);
  const failed = profile.failedCalls.length;
  const llmDraft = "the draft";

  const memoHref = `/memo/${town.slug}?fund=${program.annualFund}`;
  const planHref = (p: PlanSource) => `/town/${town.slug}?plan=${p}&fund=${program.annualFund}`;
  const exampleIndex = audit.findIndex((a) => !isKept(a.verdict) && a.replacement);
  const example = exampleIndex >= 0 ? audit[exampleIndex] : undefined;
  // Places and brands lead; a taste type whose local list is mostly national pop is shown as such.
  const tastes = (["brand", "artist", "tv_show", "podcast"] as const)
    .map((t) => ({ t, local: profile.strength[t].local, strength: profile.strength[t], items: profile.taste[t].filter((s) => s.distinct).slice(0, t === "brand" ? 4 : 3) }))
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
  // The first "#N local affinity" chip on the page carries a one-time gloss.
  const glossIndex = audit.findIndex((r) => /^(?:Qloo place|Local favourite) · #\d+ by local affinity$/.test((r.replacement ?? r.alongside)?.provenance[0]?.signal ?? ""));
  const glossRank = glossIndex >= 0 ? (audit[glossIndex].replacement ?? audit[glossIndex].alongside)!.provenance[0].signal.match(/#(\d+)/)?.[1] : undefined;
  const gloss = glossRank ? `#${glossRank} of ${profile.placeCount} places within 15 km, ranked by Qloo for how strongly locals favour them.` : undefined;
  const topPlaces = [...profile.localPlaces]
    .map((p) => ({ p, meta: profile.placeMeta.get(p.id) }))
    .sort((a, b) => (a.meta?.affinityRank ?? 1e6) - (b.meta?.affinityRank ?? 1e6))
    .slice(0, 5);

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
          <QlooCalls calls={profile.calls} />
        </div>

        <form className="no-print order-4 flex items-end gap-2 text-sm md:order-2" action={`/town/${town.slug}`}>
          <input type="hidden" name="plan" value={source} />
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Community fund a year (USD)</span>
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

        {failed > 0 && (
          <div role="alert" className="order-2 flex gap-3 rounded-md border border-hivis/35 bg-hivis-wash px-4 py-3 text-sm md:order-3 md:col-span-2">
            <Notice className="mt-0.5 h-4 w-4 text-hivis-text" />
            <p>
              <span className="font-semibold">Qloo didn&apos;t answer; this is not thin data.</span> {failed} of {profile.calls.length} Qloo calls failed, so this
              plan is missing signals. Reload in a minute; the call log below shows which ones.
            </p>
          </div>
        )}

        {profile.thin && (
          <div role="note" className="order-2 flex gap-3 rounded-md border border-amber/35 bg-amber-wash px-4 py-3 text-sm md:order-3 md:col-span-2">
            <Notice className="mt-0.5 h-4 w-4 text-amber" />
            <p>
              <span className="font-semibold">Limited local data.</span> Qloo has few local signals near {town.name} ({profile.localPlaces.length}{" "}
              independent {profile.localPlaces.length === 1 ? "place" : "places"} within 15 km). The plan is shorter on purpose: treat it as a
              starting list and add the partners residents name.
            </p>
          </div>
        )}

        <div className="order-3 grid gap-px overflow-hidden rounded-lg border border-rule bg-hairline sm:grid-cols-2 md:order-4 md:col-span-2 md:grid-cols-3">
          <Story title="Lines that could fit any town" figure={`${flagged} of ${audit.length}`} tone="flag">
            <p>draft items struck: they name nothing local, or a partner that can&apos;t be found and isn&apos;t an institution.</p>
            <p className="mt-auto pt-2.5 text-xs">
              <span className="font-mono tabular-nums text-ok-text">{audit.length - flagged}</span> kept:{" "}
              {[
                plural(keptPartners, "verified local partner", "verified local partners"),
                keptInstitutions > 0 && plural(keptInstitutions, "institution to confirm", "institutions to confirm"),
                keptMechanisms > 0 && plural(keptMechanisms, "commitment kept as drafted", "commitments kept as drafted"),
                keptSignals > 0 && plural(keptSignals, "match to a local favourite", "matches to local favourites"),
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
          </Story>
          <Story title="Local partners Qloo found" figure={String(partnerPlaces)}>
            <p>local partners in the program, each traced to Qloo&apos;s taste data.</p>
            <p className="mt-auto pt-2.5 text-xs">
              <span className="font-mono tabular-nums text-ink">{swapPlaces}</span> swap into struck lines ·{" "}
              {alongsidePlaces > 0 && (
                <>
                  <span className="font-mono tabular-nums text-ink">{alongsidePlaces}</span> added alongside kept institutions ·{" "}
                </>
              )}
              <span className="font-mono tabular-nums text-ink">{qlooAdds.length}</span> more {llmDraft} never named
              {draftAlsoNamed > 0 && (
                <>
                  {" "}
                  · <span className="font-mono tabular-nums text-ink">{draftAlsoNamed}</span> {llmDraft} also named
                </>
              )}
            </p>
          </Story>
          <Story title="Costed for the committee" figure={money(program.totalAllocated)} wide>
            <p>
              itemized for the community program across {plural(program.items.length, "item", "items")}, costed per session.{" "}
              <span className="font-mono tabular-nums text-ink">{money(program.unassigned)}</span> held in reserve for the committee: more grant cycles,
              larger awards or items residents add.
            </p>
            <p className="mt-2 text-xs">
              Fund: <span className="font-mono tabular-nums text-ink">{money(program.annualFund)}</span> a year ·{" "}
              <span className="font-mono tabular-nums text-ink">{money(program.twoYearFund)}</span> over 24 months
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
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted">Line {num(exampleIndex + 1)}</span>
              <span className="strike inline-block max-w-full justify-self-start truncate text-muted">{example.text}</span>
              <Chevron className="hidden h-3.5 w-3.5 text-muted md:block" />
              <span className="flex min-w-0 items-center gap-2">
                <Check className="h-3.5 w-3.5 text-ok" />
                <span className="truncate font-medium">{example.replacement.title}</span>
                <span className="hidden shrink-0 font-mono text-xs text-muted xl:inline">{shortSignal(example.replacement.provenance[0]?.signal)}</span>
              </span>
            </div>
          )}
        </div>
      </section>

      {/* The audit document */}
      <section aria-labelledby="audit-title" className="doc-sheet mt-8 scroll-mt-24 rounded-lg">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-rule px-5 pb-4 pt-5 sm:px-6">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted">Line-by-line check · {audit.length} draft items</p>
            <h2 id="audit-title" className="mt-1 text-lg font-semibold tracking-tight">
              The draft plan, checked against {town.name}
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
                <Link href={planHref("llm")} prefetch={false} className={secondaryCta}>
                  {draft.notice ? "Try the live AI draft again" : "Have AI write a draft now"}
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
                prefetch={p === "llm" ? false : undefined}
                className={`rounded px-3 py-1.5 transition-colors duration-150 ${
                  source === p ? "bg-paper font-medium text-ink shadow-sm" : "text-muted hover:text-ink active:bg-hairline"
                }`}
              >
                {DRAFT[p].tab}
              </Link>
            ))}
          </div>
        </div>

        {/* Verdict legend: one line, with the full definitions a click away */}
        <div className="border-b border-hairline bg-concrete/50 px-5 py-3 text-xs text-muted sm:px-6">
          <details className="group">
            <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2">
              <span className="flex items-center gap-1.5">
                <StatusPill tone="flag">Not local</StatusPill> could fit any town
              </span>
              <span className="flex items-center gap-1.5">
                <StatusPill tone="flag">Can&apos;t confirm</StatusPill> named partner not found here
              </span>
              <span className="flex items-center gap-1.5">
                <span className="flex items-center gap-1 font-medium text-ok-text">
                  <Check className="h-3.5 w-3.5" />
                  Kept
                </span>
                verified, an institution, or a commitment kept as drafted (targets, panels, in-kind help)
              </span>
              <span className="inline-flex items-center gap-0.5 font-medium text-ink underline decoration-rule underline-offset-2 group-hover:decoration-ink">
                What do these mean?
                <Chevron className="chev h-3 w-3" />
              </span>
            </summary>
        <dl className="mt-3 grid gap-x-6 gap-y-2 md:grid-cols-3">
            <div className="flex items-start gap-2">
              <dt>
                <StatusPill tone="flag">Not local</StatusPill>
              </dt>
              <dd className="pt-0.5">Names no local partner and matches nothing this town stands out for.</dd>
            </div>
            <div className="flex items-start gap-2">
              <dt>
                <StatusPill tone="flag">Can&apos;t confirm</StatusPill>
              </dt>
              <dd className="pt-0.5">Names a partner that isn&apos;t an institution and isn&apos;t found in Qloo or OpenStreetMap. It may exist; it can&apos;t be checked here.</dd>
            </div>
            <div className="flex items-start gap-2">
              <dt className="flex items-center gap-1 pt-0.5 font-medium text-ok-text">
                <Check className="h-3.5 w-3.5" />
                Kept
              </dt>
              <dd className="pt-0.5">
                Names a verified local partner or something the town stands out for, or an institution (EDC, district, college, department) we can&apos;t check
                here: those stay, for the committee to confirm. Grant mechanisms stay too, with Qloo&apos;s suggested applicants.
              </dd>
            </div>
            </dl>
          </details>
        </div>

        <div className="hidden grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)] gap-x-6 border-b border-hairline px-6 py-2 text-[11px] font-medium uppercase tracking-wider text-muted md:grid">
          <span>#</span>
          <span>Draft item</span>
          <span>Good Neighbor</span>
        </div>

        {audit.length ? (
          <ol className="px-5 sm:px-6">
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
          title="More local partners Qloo found"
          note={`Beyond the swaps above: more places residents go that ${llmDraft} never mentions. Open a row for the Qloo signal.`}
        >
          <p className="font-mono text-xs tabular-nums text-muted">{plural(qlooAdds.length, "more local partner", "more local partners")}</p>
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
                          {[
                            it.partner && it.role && `${ROLE_LABEL[it.role]}: ${it.partner.name}`,
                            it.partner?.neighbouring && "Neighbouring community",
                            it.partner?.eventSpaces && "Event space",
                            formatPhone(it.partner?.phone),
                          ]
                            .filter(Boolean)
                            .join(" · ") || it.detail}
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
                      <p className="mt-2">
                        {costLine(it)} · item budget from your fund · {cadenceLower(it.cadence)}
                      </p>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="px-6 py-8 text-sm text-muted">
            No further local partners for {town.name} beyond the swaps above. With thin local data, the committee should add places residents name.
          </p>
        )}
      </section>

      {/* Signals and guardrails */}
      <section className="mt-8 grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <div className="rounded-lg border border-rule bg-paper">
          <SectionHead
            title={`What ${town.name} favours (Qloo taste data)`}
            note="Places ranked by how strongly locals favour them (Qloo's local affinity), then tastes that stand out locally: absent from the national top 50 and the big-metro lists. Themes, not profiles of people."
          />
          <dl className="divide-y divide-hairline px-5 sm:px-6">
            {topPlaces.length > 0 && (
              <div className="grid gap-2 py-3 sm:grid-cols-[6rem_1fr] sm:items-baseline">
                <dt className="text-xs font-medium uppercase tracking-wider text-muted">Places</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {topPlaces.map(({ p, meta }) => (
                    <span key={p.id} className="rounded-full border border-hairline bg-concrete px-2.5 py-0.5 text-sm">
                      {p.name.split(" | ")[0]}
                      {meta?.affinityRank && <span className="ml-1.5 font-mono text-[11px] text-muted">#{meta.affinityRank}</span>}
                    </span>
                  ))}
                </dd>
              </div>
            )}
            {tastes.map(({ t, items, local, strength }) => (
              <div key={t} className="grid gap-2 py-3 sm:grid-cols-[6rem_1fr] sm:items-baseline">
                <dt className="text-xs font-medium uppercase tracking-wider text-muted">{TASTE_LABEL[t]}</dt>
                <dd className={`flex flex-wrap items-center gap-1.5 ${local ? "" : "text-muted"}`}>
                  {items.map((s) => (
                    <span key={s.entity.id} className={`rounded-full border px-2.5 py-0.5 text-sm ${local ? "border-hairline bg-concrete" : "border-dashed border-hairline"}`}>
                      {s.entity.name}
                    </span>
                  ))}
                  {!local && (
                    <span className="text-xs">
                      Leans national: only {strength.distinct} of {strength.total} local results stand out locally, so no plan item uses them.
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {!tastes.length && !topPlaces.length && (
            <p className="px-6 py-6 text-sm text-muted">Qloo found nothing that stands out locally for {town.name}.</p>
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
