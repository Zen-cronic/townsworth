import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Chevron, Notice } from "@/components/dashboard/Icons";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { TownSearchForm } from "@/components/TownSearchForm";
import { cleanTownQuery, geocodeTowns, type GeocodeResult } from "@/lib/nominatim";
import { FACILITY_CHOICES, isFacilityCode } from "@/lib/towns";

export const metadata: Metadata = { title: "Type any town · Good Neighbor" };

const EXAMPLES: [string, string][] = [
  ["Taylor, TX", "fab"],
  ["New Carlisle, IN", "data-center"],
  ["St. Thomas, ON", "plant"],
];

export default async function FindPage({ searchParams }: { searchParams: Promise<{ q?: string; facility?: string }> }) {
  const sp = await searchParams;
  const q = cleanTownQuery(sp.q);
  const facility = isFacilityCode(sp.facility) ? sp.facility : "data-center";
  const facilityLabel = FACILITY_CHOICES.find((f) => f.code === facility)!.label.toLowerCase();
  const result: GeocodeResult | null = q.length >= 2 ? await geocodeTowns(q, facility) : null;

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-[760px] px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted">Any host town</p>
        <h1 className="mt-1 text-[1.75rem] font-semibold leading-tight tracking-tight md:text-[2.25rem]">Type any town</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Any US or Canadian city, town or village. Qloo is queried at its coordinates, so you get the same audit, memo, exports and outreach
          drafts as the six presets. There&apos;s no frozen LLM plan for a town you enter: the typical agency template is audited, and you can ask a
          plain LLM to draft one live.
        </p>

        <div className="mt-6 rounded-lg border border-rule bg-paper p-4 sm:p-5">
          <TownSearchForm q={q} facility={facility} idPrefix="find" autoFocus={!q} />
        </div>

        {result === null && (
          <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            Try
            {EXAMPLES.map(([name, f], i) => (
              <span key={name} className="flex items-center gap-2">
                {i > 0 && (
                  <span aria-hidden className="text-rule">
                    ·
                  </span>
                )}
                <Link href={`/find?q=${encodeURIComponent(name)}&facility=${f}`} className="text-ink underline decoration-rule underline-offset-4 hover:decoration-ink">
                  {name}
                </Link>
              </span>
            ))}
          </p>
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
              </p>
            </div>
            <ol className="mt-3 space-y-2">
              {result.candidates.map((c) => {
                const href = c.preset ? `/town/${c.preset.slug}` : `/town/${c.slug}`;
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
                          {c.preset && ` · opens ${c.preset.name}, ${c.preset.project.split(" (")[0].toLowerCase()}`}
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

        <p className="mt-10 text-xs leading-relaxed text-muted">
          Town search by OpenStreetMap Nominatim (© OpenStreetMap contributors). Only the town name you type is sent to it; only the
          town&apos;s coordinates are sent to Qloo.
        </p>
      </main>
    </>
  );
}
