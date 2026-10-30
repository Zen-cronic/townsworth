import type { Metadata } from "next";
import { PRODUCT_NAME } from "@/components/landing/brand";
import "./find.css";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Chevron, Notice } from "@/components/dashboard/Icons";
import { Chip } from "@/components/ui";
import { TownSearchForm } from "@/components/TownSearchForm";
import { cleanTownQuery, geocodeTowns, type GeocodeResult } from "@/lib/nominatim";
import { cleanCompany, FACILITY_CHOICES, isFacilityCode, withCompany } from "@/lib/towns";

export const metadata: Metadata = { title: `Type any town · ${PRODUCT_NAME}` };

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
  const facilityName = FACILITY_CHOICES.find((f) => f.code === facility)!.label;
  const facilityLabel = facilityName.toLowerCase();
  const result: GeocodeResult | null = q.length >= 2 ? await geocodeTowns(q, facility) : null;

  return (
    <>
      <AppHeader />
      <main id="main" className="fd mx-auto max-w-[760px] px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
        <p className="lp-kicker">Any host town</p>
        <h1 className="lp-h1 mt-3">Type any town</h1>
        <p className="lp-lede mt-3">Any US or Canadian town gets the same check, memo and exports.</p>
        {/* What the search leads to, as the hero's caption line. */}
        <ol className="fd-steps" aria-label="What you get">
          {STEPS.map((st, i) => (
            <li key={st.title} title={st.note}>
              <span className="fd-steps-n">{i + 1}</span>
              {st.title}
            </li>
          ))}
        </ol>

        <div className="fd-form">
          <TownSearchForm q={q} facility={facility} company={company} idPrefix="find" autoFocus={!q} />
        </div>

        {result === null && (
          <section aria-labelledby="try-h" className="fd-list">
            <h2 id="try-h" className="fd-list-h">
              Or try one
            </h2>
            <ul className="find-try">
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
          <div className="fd-list fd-empty text-sm text-muted">
            <p className="font-medium text-ink">No US or Canadian city, town or village matches &ldquo;{q}&rdquo;.</p>
            <p className="mt-1">Check the spelling, or add the state or province, as in &ldquo;Taylor, TX&rdquo; or &ldquo;St. Thomas, ON&rdquo;.</p>
          </div>
        )}

        {result?.ok && result.candidates.length > 0 && (
          <section aria-labelledby="pick-h" className="fd-list">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="pick-h" className="fd-list-h">
                Pick the town
              </h2>
              <p className="text-sm text-muted">
                {result.candidates.length} {result.candidates.length === 1 ? "match" : "matches"} for &ldquo;{q}&rdquo; · {facilityLabel}
                {company ? ` · ${company}` : " · company not entered"}
              </p>
            </div>
            <ol className="fd-rows">
              {result.candidates.map((c) => {
                const href = c.preset ? `/town/${c.preset.slug}` : `/town/${withCompany(c.slug, company)}`;
                return (
                  <li key={c.slug}>
                    <Link
                      href={href}
                      className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 py-4 transition-colors duration-150 hover:bg-ink/[0.03] active:bg-ink/[0.05]"
                    >
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{c.label}</span>
                          {c.preset && <Chip tone="plain">Preset · frozen LLM plan</Chip>}
                        </span>
                        <span className="mt-1 block text-sm text-muted" title={`${c.lat.toFixed(4)}, ${c.lon.toFixed(4)}`}>
                          {/* A preset opens with its own facility and funder, so the row names those, not the form's. */}
                          {c.preset
                            ? `${c.kind.charAt(0).toUpperCase() + c.kind.slice(1)} · opens ${c.preset.name}, ${c.preset.project.split(" (")[0].toLowerCase()}, funded by ${c.preset.sponsor} per public reporting`
                            : [c.kind.charAt(0).toUpperCase() + c.kind.slice(1), facilityName, company && `funded by ${company}`].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="flex items-center gap-1 text-[15px] font-semibold text-ink underline decoration-rule underline-offset-4 group-hover:decoration-ink">
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

        <p className="fd-foot text-sm leading-relaxed text-muted">
          Town search by OpenStreetMap Nominatim (© OpenStreetMap contributors). Only the town name you type is sent to it; only the
          town&apos;s coordinates are sent to Qloo.
        </p>
      </main>
    </>
  );
}
