import type { Metadata } from "next";
import { PRODUCT_NAME } from "@/components/landing/brand";
import { secondaryCta } from "@/components/dashboard/ui";
import Form from "next/form";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { PageBand } from "@/components/ui";
import { TownSchematic } from "@/components/town/TownSchematic";

const FACILITY_NAME = { "data center": "Data center", fab: "Chip fab", nuclear: "Nuclear plant", plant: "Plant" } as const;
import { CheckForm } from "@/components/check/CheckForm";
import { Chevron, Notice } from "@/components/dashboard/Icons";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { cleanTownQuery, geocodeTowns, type GeocodeResult } from "@/lib/nominatim";
import { samplePlanById, samplePlanForTown, sampleTown } from "@/lib/samplePlans";
import { cleanCompany, FACILITY_CHOICES, HERO_TOWN, isFacilityCode, SPONSOR_PLACEHOLDER, TOWNS, townBySlug, withCompany } from "@/lib/towns";

export const metadata: Metadata = {
  title: `Check your own plan · ${PRODUCT_NAME}`,
  robots: { index: false, follow: false },
};

const field =
  "rounded-md border border-rule bg-paper text-ink transition-colors duration-150 placeholder:text-muted/80 hover:border-ink/50 focus:border-ink focus:outline-none";

function StepLabel({ children }: { children: React.ReactNode }) {
  return <p className="lp-kicker">{children}</p>;
}

// Step 1 picks the town with client-side GET navigations (next/form, Link), so the pasted text in
// step 2 survives a town switch. The plan text itself never goes into a URL: ?sample=<id> names a
// sample plan from src/lib/samplePlans.ts, which fills the form without submitting it.
export default async function CheckPage({
  searchParams,
}: {
  searchParams: Promise<{ town?: string; q?: string; facility?: string; company?: string; sample?: string }>;
}) {
  const sp = await searchParams;
  const sample = samplePlanById(sp.sample);
  const requested = sampleTown(sample, sp.town);
  const town = (requested && townBySlug(requested)) || HERO_TOWN;
  const q = cleanTownQuery(sp.q);
  const facility = isFacilityCode(sp.facility) ? sp.facility : "data-center";
  const company = cleanCompany(sp.company);
  const result: GeocodeResult | null = q.length >= 2 ? await geocodeTowns(q, facility) : null;

  return (
    <>
      <AppHeader towns={false} page="check" />
      <main id="main">
        <div className="no-print">
          <PageBand
            kicker="Your own draft"
            title="Check your own plan"
            titleId="check-h"
            visual={<TownSchematic lat={town.lat} lon={town.lon} facility={FACILITY_NAME[town.facility]} points={[]} />}
          >
            <p className="ui-band-note">Paste the plan you were sent. Each line is checked against the host town&apos;s Qloo taste data.</p>
          </PageBand>
        </div>
        <div className="ui-page">

        <section aria-labelledby="step1-h" className="no-print ui-card ck-town">
          <div className="ck-town-head">
            <span className="ck-town-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" strokeDasharray="3 2.5" />
                <circle cx="12" cy="12" r="5.5" />
                <rect x="9.5" y="9.5" width="5" height="5" rx="0.5" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <div className="min-w-0">
              <StepLabel>Host town</StepLabel>
              <h2 id="step1-h" className="mt-1 flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">
                {town.name}, {town.region}
                {town.custom && <StatusPill tone="neutral">Entered by you</StatusPill>}
              </h2>
              <p className="mt-1 text-sm text-muted">{town.project}</p>
            </div>
          </div>
          <ul className="ck-town-facts" aria-label="About this town">
            <li className="is-qloo">{FACILITY_NAME[town.facility]}</li>
            {town.sponsorSource !== "placeholder" && (
              <li>
                <span>Funder</span> {town.sponsor}
              </li>
            )}
            <li className="is-ok">
              <span>Annual fund</span> ${town.defaultAnnualFund.toLocaleString("en-US")}
            </li>
            <li>
              <span>Site</span> {Math.abs(town.lat).toFixed(4)}° {town.lat >= 0 ? "N" : "S"}, {Math.abs(town.lon).toFixed(4)}° {town.lon >= 0 ? "E" : "W"}
            </li>
          </ul>

          <div className="ck-town-pick grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-8">
            <Form action="/check" className="flex items-end gap-2">
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                <span className="text-xs text-muted">A preset town</span>
                <select name="town" defaultValue={town.custom ? "" : town.slug} className={`${field} h-11 px-2.5`}>
                  {town.custom && <option value="">Choose a preset…</option>}
                  {TOWNS.map((t) => (
                    <option key={t.slug} value={t.slug}>
                      {t.name}, {t.region}
                    </option>
                  ))}
                </select>
              </label>
              <button className={`${secondaryCta} h-11`}>
                Use
              </button>
            </Form>

            {/* Any other town sits one click away, so the paste box is close on a phone. It opens itself
                when a search is in the address or the town was typed in. */}
            <details className="group self-end" open={!!q || town.custom || undefined}>
              <summary className={`${secondaryCta} ck-other h-11 cursor-pointer group-open:mb-3`}>
                Use another town
                <Chevron className="h-3.5 w-3.5 transition-transform duration-150 group-open:rotate-90" />
              </summary>
            <Form action="/check" className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9.5rem_minmax(0,11rem)_auto] sm:items-end">
              <label className="flex min-w-0 flex-col gap-1 text-sm">
                <span className="text-xs text-muted">Or any US or Canadian town</span>
                <input
                  name="q"
                  type="search"
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="off"
                  defaultValue={q}
                  placeholder="e.g. Taylor, TX"
                  className={`${field} h-10 w-full px-3`}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-muted">Facility</span>
                <select name="facility" defaultValue={facility} className={`${field} h-10 px-2.5`}>
                  {FACILITY_CHOICES.map((f) => (
                    <option key={f.code} value={f.code}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-sm">
                <span className="text-xs text-muted">Company funding the program (optional)</span>
                <input
                  name="company"
                  type="text"
                  maxLength={40}
                  autoComplete="organization"
                  defaultValue={company}
                  placeholder={SPONSOR_PLACEHOLDER}
                  className={`${field} h-10 w-full px-3`}
                />
              </label>
              <button className={`${secondaryCta} h-10`}>
                Find
              </button>
            </Form>
            </details>
          </div>

          {result && !result.ok && (
            <p role="alert" className="mt-4 flex gap-2 rounded-md border border-amber/35 bg-amber-wash px-3 py-2 text-sm">
              <Notice className="mt-0.5 h-4 w-4 text-amber" />
              <span>
                The town search didn&apos;t answer{result.status ? ` (OpenStreetMap HTTP ${result.status})` : ""}. Wait a few seconds and search
                again, or pick a preset.
              </span>
            </p>
          )}
          {result?.ok && result.candidates.length === 0 && (
            <p className="mt-4 rounded-md border border-dashed border-rule px-3 py-2 text-sm text-muted">
              No US or Canadian city, town or village matches &ldquo;{q}&rdquo;. Add the state or province, as in &ldquo;Taylor, TX&rdquo;.
            </p>
          )}
          {result?.ok && result.candidates.length > 0 && (
            <ol aria-label="Matching towns" className="mt-4 grid gap-2 sm:grid-cols-2">
              {result.candidates.map((c) => {
                const slug = c.preset ? c.preset.slug : withCompany(c.slug, company);
                const on = slug === town.slug;
                return (
                  <li key={c.slug}>
                    <Link
                      href={`/check?town=${encodeURIComponent(slug)}`}
                      scroll={false}
                      aria-current={on ? "true" : undefined}
                      className={`group flex items-center justify-between gap-3 rounded-btn border px-3 py-2 text-sm transition-colors duration-150 hover:border-ink active:bg-concrete ${on ? "border-ink bg-concrete" : "border-rule bg-paper"}`}
                    >
                      <span className="min-w-0">
                        <span className="font-medium">{c.label}</span>
                        <span className="block font-mono text-[11px] tabular-nums text-muted">
                          {c.lat.toFixed(4)}, {c.lon.toFixed(4)}
                          {c.preset && " · preset"}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-muted group-hover:text-ink">
                        {on ? "Selected" : "Use"}
                        <Chevron className="h-3.5 w-3.5" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <CheckForm town={town} sample={sample} townSample={samplePlanForTown(town.slug)} />

        <p className="no-print ui-note mt-10">
          Town search © OpenStreetMap contributors · taste data from Qloo ·{" "}
          <Link href={`/town/${town.slug}`}>memo and ballot on the town page</Link>
        </p>
        </div>
      </main>
    </>
  );
}
