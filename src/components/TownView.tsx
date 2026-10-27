import Link from "next/link";
import { money, PLAN_LABEL, type PlanSource, type TownRun } from "@/lib/run";
import { BUCKETS, type ProgramItem } from "@/lib/plan";
import type { AuditRow } from "@/lib/audit";

const FACILITY_LABEL: Record<string, string> = {
  "data center": "Data center",
  fab: "Chip fab",
  nuclear: "Nuclear",
  plant: "Plant",
};

function Stat({ value, label, tone }: { value: string; label: string; tone?: "flag" | "ok" }) {
  const color = tone === "flag" ? "text-hivis-text" : tone === "ok" ? "text-ok-text" : "text-ink";
  return (
    <div className="rounded-md border border-rule bg-paper px-4 py-3">
      <div className={`font-mono text-2xl font-medium tabular-nums ${color}`}>{value}</div>
      <div className="mt-1 text-sm leading-snug text-muted">{label}</div>
    </div>
  );
}

function ProvenanceChip({ item }: { item: ProgramItem }) {
  return (
    <details className="group mt-2 text-xs">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded border border-hairline bg-concrete px-2 py-1 font-mono text-muted marker:hidden hover:border-rule">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ok" />
        {item.provenance[0]?.signal ?? "Qloo signal"}
        <span className="text-muted/70 group-open:hidden">· why?</span>
      </summary>
      <ul className="mt-2 space-y-1 border-l-2 border-hairline pl-3 text-muted">
        {item.provenance.map((p, i) => (
          <li key={i}>
            <span className="font-mono text-ink">{p.signal}</span>: {p.detail}
          </li>
        ))}
      </ul>
    </details>
  );
}

function Replacement({ item }: { item: ProgramItem }) {
  const p = item.partner;
  return (
    <div className="slide-in rounded-md border border-ok/40 bg-paper p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-ok-text">{BUCKETS[item.bucket].label}</div>
      <div className="mt-0.5 font-medium leading-snug">{item.title}</div>
      {p && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
          {p.distanceKm != null && <span>{p.distanceKm} km from site</span>}
          {p.rating != null && <span>Rated {p.rating.toFixed(1)}</span>}
          {p.eventSpaces && <span>Has event space</span>}
          {p.phone && <span className="font-mono">{p.phone}</span>}
        </div>
      )}
      <div className="mt-2 flex items-baseline justify-between gap-3 text-sm">
        <span className="font-mono tabular-nums">{money(item.amount)}</span>
        <span className="text-xs text-muted">from your fund · {BUCKETS[item.bucket].cadence.toLowerCase()}</span>
      </div>
      <ProvenanceChip item={item} />
    </div>
  );
}

function AuditLine({ row, index }: { row: AuditRow; index: number }) {
  const flagged = row.verdict !== "grounded";
  return (
    <li className="grid gap-3 border-b border-hairline py-4 md:grid-cols-[1fr_minmax(0,1.05fr)]">
      <div>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 w-6 shrink-0 font-mono text-xs text-muted">{String(index + 1).padStart(2, "0")}</span>
          <div>
            <p className={`leading-snug ${flagged ? "text-muted" : ""}`}>
              <span className={flagged ? "strike" : ""} style={flagged ? { animationDelay: `${index * 70}ms` } : undefined}>
                {row.text}
              </span>
            </p>
            <p className={`mt-1 text-xs ${flagged ? "text-hivis-text" : "text-ok-text"}`}>
              {row.verdict === "grounded" ? "✓ Grounded. " : row.verdict === "unverified" ? "Unverified. " : "Generic. "}
              {row.reasons[0]}
            </p>
          </div>
        </div>
      </div>
      <div>
        {flagged && row.replacement ? (
          <Replacement item={row.replacement} />
        ) : flagged ? (
          <p className="rounded-md border border-dashed border-rule px-3 py-2 text-sm text-muted">
            No like-for-like local swap. This budget moves into the program in the commitments memo.
          </p>
        ) : (
          <p className="pt-1 text-sm text-ok-text">
            Keep{row.matched ? `: ${row.matched.name}` : ""}
            {row.matched?.source === "osm" ? " · verified on OpenStreetMap" : row.matched?.source === "qloo" ? " · in Qloo's local data" : ""}
          </p>
        )}
      </div>
    </li>
  );
}

export function TownView({ run }: { run: TownRun }) {
  const { town, profile, program, audit, source, qlooAdds } = run;
  const flagged = audit.filter((a) => a.verdict !== "grounded").length;
  const verified = audit.filter((a) => a.matched).length;
  const planHref = (p: PlanSource) => `/town/${town.slug}?plan=${p}&fund=${program.annualFund}`;
  const distinctSignals = (["brand", "artist", "tv_show", "podcast"] as const).flatMap((t) =>
    profile.taste[t].filter((s) => s.distinct).slice(0, t === "brand" ? 4 : 3),
  );

  return (
    <main className="mx-auto max-w-6xl px-5 pb-24 pt-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">
            {FACILITY_LABEL[town.facility]} host community · {town.project}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
            {town.name}, {town.region}
          </h1>
          <p className="mt-2 max-w-2xl text-muted">
            A draft community plan, checked item by item. Real local partners are kept; generic items are struck and replaced with
            places {town.name} over-indexes on, each traceable to a Qloo signal.
          </p>
        </div>
        <form className="no-print flex items-end gap-2 text-sm" action="">
          <label className="flex flex-col gap-1">
            <span className="text-muted">Annual community fund (USD)</span>
            <input
              name="fund"
              type="number"
              min={10000}
              step={10000}
              defaultValue={program.annualFund}
              className="w-44 rounded-md border border-rule bg-paper px-3 py-2 font-mono tabular-nums focus:border-ink focus:outline-none"
            />
          </label>
          <button className="rounded-md border border-ink px-3 py-2 font-medium hover:bg-ink hover:text-paper">Re-plan</button>
        </form>
      </section>

      {profile.thin && (
        <p className="mt-5 rounded-md border border-amber/40 bg-amber-wash px-4 py-3 text-sm text-ink">
          Thin data: Qloo has few local signals near {town.name} ({profile.localPlaces.length} independent places within 15 km).
          The plan below is shorter on purpose, so treat it as a starting list and add partners residents name.
        </p>
      )}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat value={`${flagged} of ${audit.length}`} label="draft items name nothing local or can't be verified" tone="flag" />
        <Stat value={`${verified} of ${audit.length}`} label="draft items name a real local partner (kept)" tone="ok" />
        <Stat value={String(qlooAdds.length + audit.filter((a) => a.replacement).length)} label="resident-favourite partners Qloo adds that the draft never named" />
        <Stat value={money(program.totalAllocated)} label="allocated over 24 months from your fund" />
      </section>

      <section className="mt-8 rounded-lg border border-rule bg-paper">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule px-5 py-3">
          <div>
            <h2 className="font-semibold">Plan audit</h2>
            <p className="text-xs text-muted">Left: the draft. Right: what Good Neighbor keeps or proposes instead.</p>
          </div>
          <div role="tablist" aria-label="Draft plan to audit" className="no-print flex gap-1 rounded-md border border-rule p-0.5 text-sm">
            {(["llm", "agency"] as const).map((p) => (
              <Link
                key={p}
                role="tab"
                aria-selected={source === p}
                href={planHref(p)}
                className={`rounded px-3 py-1 ${source === p ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}
              >
                {PLAN_LABEL[p]}
              </Link>
            ))}
          </div>
        </div>
        <ol className="px-5">
          {audit.map((row, i) => (
            <AuditLine key={i} row={row} index={i} />
          ))}
        </ol>
        <div className="no-print flex flex-wrap items-center justify-between gap-3 border-t border-rule px-5 py-4">
          <p className="text-sm text-muted">Every proposal carries the Qloo signal behind it. Costs come from your fund, not from Qloo.</p>
          <Link
            href={`/memo/${town.slug}?fund=${program.annualFund}`}
            className="rounded-md bg-hivis px-4 py-2 font-medium text-white hover:bg-hivis-text"
          >
            Open the commitments memo →
          </Link>
        </div>
      </section>

      {qlooAdds.length > 0 && (
        <section className="mt-8 rounded-lg border border-rule bg-paper">
          <div className="border-b border-rule px-5 py-3">
            <h2 className="font-semibold">What Qloo adds</h2>
            <p className="text-xs text-muted">
              The draft names the town&apos;s institutions. These are places residents actually go, which the draft never mentions.
            </p>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {qlooAdds.map((it) => (
              <Replacement key={it.id} item={it} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-8 grid gap-6 md:grid-cols-[1.2fr_1fr]">
        <div className="rounded-lg border border-rule bg-paper p-5">
          <h2 className="font-semibold">What {town.name} over-indexes on</h2>
          <p className="mt-1 text-sm text-muted">
            Aggregate Qloo affinities near the site that are not in the national top 20 or the big-metro lists. These are themes, not
            profiles of people.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {distinctSignals.map((s) => (
              <li key={s.entity.id} className="rounded-full border border-hairline bg-concrete px-3 py-1 text-sm">
                {s.entity.name}
                <span className="ml-1.5 font-mono text-xs text-muted">{s.entity.type.replace("_", " ")}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-rule bg-paper p-5">
          <h2 className="font-semibold">Guardrails</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-muted">
            <li>Not persuasion: nothing here is scheduled around a vote, hearing or permit.</li>
            <li>Residents rank the shortlist; the community committee decides.</li>
            <li>No political, religious or identity targeting. {profile.excluded.length} {profile.excluded.length === 1 ? "result was" : "results were"} excluded by rule.</li>
            <li>Every message carries the sponsor&apos;s name. Signals are aggregate, never individual.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
