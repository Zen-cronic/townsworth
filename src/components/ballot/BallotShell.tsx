import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { ChevronLeft } from "@/components/dashboard/Icons";
import { secondaryCta } from "@/components/dashboard/ui";

// Shared frame for the resident ballot and the committee view: narrow, mobile-first, calm.
export function BallotShell({
  slug,
  kicker,
  title,
  funder,
  children,
}: {
  slug: string;
  kicker: string;
  title: string;
  funder?: { line: string; placeholder: boolean; fixHref?: string };
  children: React.ReactNode;
}) {
  return (
    <>
      <AppHeader towns={false} />
      <main id="main" className="bl mx-auto max-w-[680px] px-4 pb-24 pt-5 sm:px-6 sm:pt-8">
        <Link
          href={`/memo/${slug}`}
          className="inline-flex items-center gap-1 rounded-md py-1.5 pr-2 text-sm text-muted transition-colors duration-150 hover:text-ink"
        >
          <ChevronLeft />
          Back to the memo
        </Link>
        <p className="lp-kicker mt-6">{kicker}</p>
        <h1 className="ui-h3 mt-2 sm:text-[2rem]">{title}</h1>
        {funder && <FundedBy {...funder} />}
        {children}
      </main>
    </>
  );
}

// Sponsor disclosure: residents see who pays for the program before they rank anything.
function FundedBy({ line, placeholder, fixHref }: { line: string; placeholder: boolean; fixHref?: string }) {
  return (
    <p data-testid="ballot-funder" className={`mt-2 flex items-start gap-2 text-sm ${placeholder ? "text-amber" : "text-ink/80"}`}>
      <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mt-0.5 h-4 w-4 shrink-0 text-muted">
        <path d="M2.5 14V6.5L8 3l5.5 3.5V14" strokeLinejoin="round" />
        <path d="M6 14v-3.5h4V14M1.5 14h13" strokeLinecap="round" />
      </svg>
      <span>
        <span className="font-medium">{line}</span>
        {placeholder && fixHref && (
          <>
            {" · "}
            <Link href={fixHref} className="underline underline-offset-4">
              Add the company
            </Link>
          </>
        )}
      </span>
    </p>
  );
}

export function PrivacyLine() {
  return (
    <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-ink">
      <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="mt-0.5 h-4 w-4 shrink-0 text-ok">
        <rect x="3" y="7" width="10" height="7" rx="1.5" />
        <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" strokeLinecap="round" />
      </svg>
      <span>Your ballot stays in this browser. Nothing is sent to Qloo.</span>
    </p>
  );
}

export function ThinShortlist({ slug, townName, count }: { slug: string; townName: string; count: number }) {
  return (
    <div className="mt-6 border-t border-rule pt-5">
      <p className="font-semibold">Not enough ideas to rank yet</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        Qloo returned {count === 0 ? "no" : "only one"} resident-facing {count === 1 ? "idea" : "ideas"} for {townName}, so there is nothing to put
        in order. The committee can add items to the memo first.
      </p>
      <Link href={`/memo/${slug}`} className={`${secondaryCta} mt-4`}>
        Back to the memo
      </Link>
    </div>
  );
}
