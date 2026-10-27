import Link from "next/link";
import { TOWNS } from "@/lib/towns";

export function AppHeader({ active }: { active?: string }) {
  return (
    <header className="no-print border-b border-rule bg-paper">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span aria-hidden className="inline-block h-4 w-4 rounded-[3px] bg-hivis" />
          Good Neighbor
        </Link>
        <nav aria-label="Host communities" className="flex flex-wrap gap-1.5 text-sm">
          {TOWNS.map((t) => (
            <Link
              key={t.slug}
              href={`/town/${t.slug}`}
              aria-current={active === t.slug ? "page" : undefined}
              className={`rounded-full border px-3 py-1 transition-colors duration-150 ${
                active === t.slug
                  ? "border-ink bg-ink text-paper"
                  : "border-rule text-muted hover:border-ink hover:text-ink"
              }`}
            >
              {t.name}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex gap-4 text-sm text-muted">
          <Link href="/proof" className="hover:text-ink">Proof</Link>
          <Link href="/judges" className="hover:text-ink">Start here</Link>
        </div>
      </div>
    </header>
  );
}
