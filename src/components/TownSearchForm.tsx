import { FACILITY_CHOICES, SPONSOR_PLACEHOLDER, type FacilityCode } from "@/lib/towns";

// A plain GET form to /find, so it works without JavaScript. Geocoding happens on the server.

const field =
  "rounded-md border border-rule bg-paper text-ink transition-colors duration-150 placeholder:text-muted/80 hover:border-ink/50 focus:border-ink focus:outline-none";

export function HeaderTownSearch() {
  return (
    <form action="/find" role="search" aria-label="Try any town" className="mr-1 hidden items-center md:flex lg:hidden xl:flex">
      <label className="sr-only" htmlFor="hdr-town">
        Try any US or Canadian town
      </label>
      <input
        id="hdr-town"
        name="q"
        type="search"
        required
        minLength={2}
        maxLength={80}
        autoComplete="off"
        placeholder="Any town"
        className={`${field} w-36 rounded-r-none px-2.5 py-1.5 text-sm xl:w-24`}
      />
      <button className="-ml-px rounded-md rounded-l-none border border-ink bg-ink px-2.5 py-1.5 text-sm font-medium text-paper transition-colors duration-150 hover:bg-ink/85 active:bg-ink/75">
        Go
      </button>
    </form>
  );
}

export function TownSearchForm({
  q = "",
  facility = "data-center",
  company = "",
  idPrefix = "town",
  autoFocus,
}: {
  q?: string;
  facility?: FacilityCode;
  company?: string;
  idPrefix?: string;
  autoFocus?: boolean;
}) {
  return (
    <form action="/find" role="search" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-end">
      <label className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="text-xs text-muted">Host town (US or Canada)</span>
        <input
          id={`${idPrefix}-q`}
          name="q"
          type="search"
          required
          minLength={2}
          maxLength={80}
          autoComplete="off"
          autoFocus={autoFocus}
          defaultValue={q}
          placeholder="e.g. Taylor, TX"
          className={`${field} h-10 w-full px-3`}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs text-muted">Facility</span>
        <select id={`${idPrefix}-facility`} name="facility" defaultValue={facility} className={`${field} h-10 px-2.5`}>
          {FACILITY_CHOICES.map((f) => (
            <option key={f.code} value={f.code}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="text-xs text-muted">Company funding the program</span>
        <input
          id={`${idPrefix}-company`}
          name="company"
          type="text"
          maxLength={40}
          autoComplete="organization"
          defaultValue={company}
          placeholder={SPONSOR_PLACEHOLDER}
          aria-describedby={`${idPrefix}-company-help`}
          className={`${field} h-10 w-full px-3`}
        />
      </label>
      <button className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-ink px-4 text-sm font-semibold text-paper transition-colors duration-150 hover:bg-ink/85 active:bg-ink/75">
        Find town
      </button>
      <p id={`${idPrefix}-company-help`} className={`text-xs leading-relaxed sm:col-span-2 ${company ? "text-muted" : "text-amber"}`}>
        {company
          ? `Every outreach draft and the resident ballot will name ${company} as the funder.`
          : `Fill in the company: every outreach draft and the resident ballot name the funder. Left blank, they say “${SPONSOR_PLACEHOLDER}”.`}
      </p>
    </form>
  );
}
