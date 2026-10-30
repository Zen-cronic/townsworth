import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Chevron, Notice } from "@/components/dashboard/Icons";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { TownSearchForm } from "@/components/TownSearchForm";
import { cleanTownQuery, geocodeTowns, type GeocodeResult } from "@/lib/nominatim";
import { cleanCompany, FACILITY_CHOICES, isFacilityCode, withCompany } from "@/lib/towns";

export const metadata: Metadata = { title: "Type any town · Good Neighbor" };

// Companies as reported publicly for each example project.
const EXAMPLES: [string, string, string][] = [
  ["Taylor, TX", "fab", "Samsung"],
  ["New Carlisle, IN", "data-center", "Amazon"],
  ["St. Thomas, ON", "plant", "PowerCo"],
];

const ICON = "h-5 w-5";
const STEPS: { title: string; note: string; icon: React.ReactNode }[] = [
  {
    title: "Type the town",
    note: "and the company funding it",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={ICON} aria-hidden>
        <path d="M10 18s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" />
        <circle cx="10" cy="8" r="2.2" />
      </svg>
    ),
  },
  {
    title: "Each line checked",
    note: "kept, or struck and replaced",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={ICON} aria-hidden>
        <path d="M3 5.5l1.6 1.6L7.5 4M3 13.5l1.6 1.6 2.9-3.1M10 6h7M10 14h7" />
      </svg>
    ),
  },
  {
    title: "A costed memo",
    note: "with a partner sheet and calendar",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={ICON} aria-hidden>
        <path d="M5 2.5h7l3 3v12H5z" />
        <path d="M8 9h4M8 12h4M8 15h2.5" />
      </svg>
    ),
  },
  {
    title: "Residents rank",
    note: "on an anonymous ballot",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={ICON} aria-hidden>
        <path d="M4 16V11M10 16V5M16 16V8M2.5 16.5h15" />
      </svg>
    ),
  },
];

export default async function FindPage({ searchParams }: { searchParams: Promise<{ q?: string; facility?: string; company?: string }> }) {
  const sp = await searchParams;
  const q = cleanTownQuery(sp.q);
  const facility = isFacilityCode(sp.facility) ? sp.facility : "data-center";
  const company = cleanCompany(sp.company);
  const facilityLabel = FACILITY_CHOICES.find((f) => f.code === facility)!.label.toLowerCase();
  const result: GeocodeResult | null = q.length >= 2 ? await geocodeTowns(q, facility) : null;

  return (
    <>
      <AppHeader />
      <main id="main" className="mx-auto max-w-[760px] px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
        <p className="lp-kicker">Any host town</p>
        <h1 className="lp-h1 mt-3">Type any town</h1>
        <p className="lp-lede mt-3">Any US or Canadian town gets the same check, memo and exports.</p>

        <div className="ui-card mt-8 p-4 sm:p-6">
          <TownSearchForm q={q} facility={facility} company={company} idPrefix="find" autoFocus={!q} />
        </div>

        {result === null && (
          <section aria-labelledby="try-h" className="mt-6">
            <h2 id="try-h" className="font-mono text-[11px] uppercase tracking-wider text-muted">
              Or try one
            </h2>
            <ul className="find-try mt-2">
              {EXAMPLES.map(([name, f, co]) => (
                <li key={name}>
                  <Link href={`/find?q=${encodeURIComponent(name)}&facility=${f}&company=${encodeURIComponent(co)}`}>
                    <span className="find-try-t">{name}</span>
                    <span className="find-try-m">
                      {FACILITY_CHOICES.find((c) => c.code === f)?.label} · {co}
                    </span>
                    <Chevron className="find-try-c h-3.5 w-3.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {result && !result.ok && (
          <div role="alert" className="mt-6 flex gap-3 rounded-md border border-amber/35 bg-amber-wash px-4 py-3 text-sm">
            <Notice className="mt-0.5 h-4 w-4 text-amber" />
            <p>
              <span className="font-semibold">The town search didn&apos;t answer</span>
              {result.status ? ` (OpenStreetMap HTTP ${result.status})` : ""}. Wait a few seconds and search again, or open one of the{" "}
              <Link href="/#towns-h" className="underline underline-offset-4">
                six preset towns
              </Link>
              .
            </p>
          </div>
        )}

        {result?.ok && result.candidates.length === 0 && (
          <div className="mt-6 rounded-md border border-dashed border-rule px-4 py-5 text-sm text-muted">
            <p className="font-medium text-ink">No US or Canadian city, town or village matches &ldquo;{q}&rdquo;.</p>
            <p className="mt-1">Check the spelling, or add the state or province, as in &ldquo;Taylor, TX&rdquo; or &ldquo;St. Thomas, ON&rdquo;.</p>
          </div>
        )}

        {result?.ok && result.candidates.length > 0 && (
          <section aria-labelledby="pick-h" className="mt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule pb-2">
              <h2 id="pick-h" className="font-semibold tracking-tight">
                Pick the town
              </h2>
              <p className="text-xs text-muted">
                {result.candidates.length} {result.candidates.length === 1 ? "match" : "matches"} for &ldquo;{q}&rdquo; · {facilityLabel}
                {company ? ` · ${company}` : " · company not entered"}
              </p>
            </div>
            <ol className="mt-3 space-y-2">
              {result.candidates.map((c) => {
                const href = c.preset ? `/town/${c.preset.slug}` : `/town/${withCompany(c.slug, company)}`;
                return (
                  <li key={c.slug}>
                    <Link
                      href={href}
                      className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 rounded-md border border-rule bg-paper px-4 py-3 transition-colors duration-150 hover:border-ink active:bg-concrete"
                    >
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{c.label}</span>
                          {c.preset && <StatusPill tone="ok">Preset · frozen LLM plan</StatusPill>}
                        </span>
                        <span className="mt-0.5 block font-mono text-xs tabular-nums text-muted">
                          {c.lat.toFixed(4)}, {c.lon.toFixed(4)} · {c.kind}
                          {c.preset && ` · opens ${c.preset.name}, ${c.preset.project.split(" (")[0].toLowerCase()}, funded by ${c.preset.sponsor} per public reporting`}
                        </span>
                      </span>
                      <span className="flex items-center gap-1 text-sm text-muted group-hover:text-ink">
                        <span className="hidden sm:inline">Open the audit</span>
                        <Chevron className="h-3.5 w-3.5" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        <ol className="find-line mt-10" aria-label="What you get">
          {STEPS.map((st) => (
            <li key={st.title} title={st.note}>
              {st.title}
            </li>
          ))}
        </ol>

        <p className="mt-10 text-xs leading-relaxed text-muted">
          Town search by OpenStreetMap Nominatim (© OpenStreetMap contributors). Only the town name you type is sent to it; only the
          town&apos;s coordinates are sent to Qloo.
        </p>
      </main>
    </>
  );
}
