import Link from "next/link";
import { TOWNS } from "@/lib/towns";
import { HeaderTownSearch } from "@/components/TownSearchForm";
import { PRODUCT_NAME } from "@/components/landing/brand";
import { BrandMark } from "@/components/landing/BrandMark";
import { CenterCurrent } from "@/components/ui/CenterCurrent";

const navLink =
  "rounded-md px-2.5 py-1.5 text-sm max-[400px]:px-2 transition-colors duration-150 hover:bg-concrete hover:text-ink active:bg-hairline";

// One header on every page: the wordmark and primary links on top, and on product pages a thin
// second row that switches town. Opaque paper, so nothing shows through when scrolled.
// `data-towns` sets the header height (--l-hdr) that sticky rails and anchor offsets clear.
// Below 400px the links tighten; below 380px the wordmark text collapses to the mark, so the
// links fit on one row inside the page padding.
// The first Tab stop skips the header and town strip. A page can point it somewhere more useful
// than the top of <main id="main">, such as the audit on a town page.
export function AppHeader({
  active,
  page,
  towns = true,
  skip = { href: "#main", label: "Skip to content" },
}: {
  active?: string;
  page?: "proof" | "judges" | "check";
  towns?: boolean;
  skip?: { href: string; label: string };
}) {
  const searchIcon = (
    <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <circle cx="7" cy="7" r="4.25" />
      <path d="m10.25 10.25 3 3" strokeLinecap="round" />
    </svg>
  );
  const current = (p: string) => (page === p ? "page" : undefined);
  return (
    <header data-app-header="" data-towns={towns ? "" : undefined} className="no-print sticky top-0 z-30 border-b border-hairline bg-paper">
      <a
        href={skip.href}
        className="sr-only rounded-md bg-ink px-3 py-2 text-sm font-medium text-paper focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-40"
      >
        {skip.label}
      </a>
      <div className="mx-auto flex max-w-[1240px] items-center gap-x-4 px-4 py-2.5 max-[400px]:gap-x-2 sm:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md py-1 pr-1 font-semibold tracking-tight">
          <BrandMark size={22} />
          <span className="max-[380px]:sr-only">{PRODUCT_NAME}</span>
        </Link>
        <nav aria-label="Primary" className="ml-auto flex items-center gap-0.5 text-muted">
          <HeaderTownSearch />
          <Link href="/find" title="Find a town" className={`${navLink} inline-flex items-center md:hidden`}>
            {searchIcon}
            <span className="sr-only">Find a town</span>
          </Link>
          <Link href="/check" aria-current={current("check")} className={`${navLink} ${page === "check" ? "text-ink" : ""}`}>
            <span className="sm:hidden">Check</span>
            <span className="hidden sm:inline">Check a plan</span>
          </Link>
          <Link href="/proof" aria-current={current("proof")} className={`${navLink} ${page === "proof" ? "text-ink" : ""}`}>
            Evidence
          </Link>
          <Link href="/judges" aria-current={current("judges")} className={`${navLink} ${page === "judges" ? "text-ink" : ""}`}>
            <span className="sm:hidden">Tour</span>
            <span className="hidden sm:inline">Product tour</span>
          </Link>
        </nav>
      </div>

      {towns && (
        <div className="border-t border-hairline bg-concrete/60">
          <nav
            aria-label="Towns"
            className="no-scrollbar fade-x mx-auto flex max-w-[1240px] items-center gap-0.5 overflow-x-auto px-4 py-1 sm:px-8"
          >
            <span className="mr-2 hidden shrink-0 font-mono text-[11px] uppercase tracking-wider text-muted sm:inline">Towns</span>
            {TOWNS.map((t) => {
              const on = active === t.slug;
              return (
                <Link
                  key={t.slug}
                  href={`/town/${t.slug}`}
                  aria-current={on ? "page" : undefined}
                  title={`${t.name}, ${t.region}`}
                  className={`shrink-0 rounded-md px-2.5 py-1 text-sm transition-colors duration-150 ${
                    on ? "bg-paper font-medium text-ink shadow-[0_0_0_1px_var(--hairline)]" : "text-muted hover:bg-paper hover:text-ink"
                  }`}
                >
                  {t.name}
                </Link>
              );
            })}
            <Link href="/find" className="shrink-0 rounded-md border border-rule px-2.5 py-0.5 text-sm text-ink transition-colors duration-150 hover:border-ink hover:bg-paper">
              Find a town
            </Link>
          </nav>
          <CenterCurrent navLabel="Towns" />
        </div>
      )}
    </header>
  );
}
