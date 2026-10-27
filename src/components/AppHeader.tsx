import Link from "next/link";
import { TOWNS } from "@/lib/towns";

const navLink =
  "rounded-md px-2.5 py-1.5 text-sm transition-colors duration-150 hover:bg-concrete hover:text-ink active:bg-hairline";

// `towns={false}` hides the host-community switcher (the landing page shows only the wordmark and nav).
export function AppHeader({ active, page, towns = true }: { active?: string; page?: "proof" | "judges"; towns?: boolean }) {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-rule bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 sm:px-6">
        <Link href="/" className="flex items-center gap-2 rounded-md py-1 pr-1 font-semibold tracking-tight">
          <span aria-hidden className="grid h-5 w-5 place-items-center rounded-[4px] bg-hivis">
            <span className="h-[3px] w-2.5 rounded-full bg-paper" />
          </span>
          Good Neighbor
        </Link>

        {towns && (
          <nav
            aria-label="Host communities"
            className="no-scrollbar fade-x order-3 -mx-4 flex w-[calc(100%+2rem)] items-center gap-0.5 overflow-x-auto px-4 pb-0.5 lg:order-2 lg:mx-0 lg:w-auto lg:px-0"
          >
            <span className="mr-1 hidden shrink-0 text-xs text-muted/80 xl:inline">Host community</span>
            {TOWNS.map((t) => {
              const on = active === t.slug;
              return (
                <Link
                  key={t.slug}
                  href={`/town/${t.slug}`}
                  aria-current={on ? "page" : undefined}
                  title={`${t.name}, ${t.region}`}
                  className={`shrink-0 rounded-md px-2.5 py-1.5 text-sm transition-colors duration-150 ${
                    on
                      ? "font-medium text-ink underline decoration-ink decoration-2 underline-offset-[7px]"
                      : "text-muted hover:bg-concrete hover:text-ink active:bg-hairline"
                  }`}
                >
                  {t.name}
                </Link>
              );
            })}
          </nav>
        )}

        <nav aria-label="Primary" className="order-2 ml-auto flex items-center gap-0.5 text-muted lg:order-3">
          <Link href="/proof" aria-current={page === "proof" ? "page" : undefined} className={`${navLink} ${page === "proof" ? "text-ink" : ""}`}>
            Proof
          </Link>
          <Link
            href="/judges"
            aria-current={page === "judges" ? "page" : undefined}
            className={`${navLink} ${page === "judges" ? "text-ink" : ""}`}
          >
            Start here
          </Link>
        </nav>
      </div>
    </header>
  );
}
