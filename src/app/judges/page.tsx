import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Chevron } from "@/components/dashboard/Icons";
import { HERO_TOWN } from "@/lib/towns";

const STEPS: { title: string; body: string; href: string; cta: string }[] = [
  {
    title: `Open ${HERO_TOWN.name}, ${HERO_TOWN.region}`,
    body: "A draft community plan, red-penned item by item. Generic items are struck; real local partners are kept.",
    href: `/town/${HERO_TOWN.slug}`,
    cta: "Open the audit",
  },
  {
    title: "Click “Why” on any proposal",
    body: "Each replacement shows the Qloo signal behind it: a local place, its distance, or a taste the town over-indexes on.",
    href: `/town/${HERO_TOWN.slug}`,
    cta: "See a proposal",
  },
  {
    title: "Open the commitments memo",
    body: "The document a community committee would review, with item budgets from your fund. Download the partner sheet or the calendar.",
    href: `/memo/${HERO_TOWN.slug}`,
    cta: "Open the memo",
  },
  {
    title: "Switch town in the header",
    body: "The picks change because the town's signals change. Kemmerer, Wyoming shows how the plan behaves when local data is thin.",
    href: "/town/kemmerer-wy",
    cta: "Try Kemmerer",
  },
  {
    title: "Check the proof",
    body: "Qloo versus a plain LLM across six towns, with a negative control and a list of what the test does not prove.",
    href: "/proof",
    cta: "Open the proof",
  },
];

export default function JudgesPage() {
  return (
    <>
      <AppHeader page="judges" />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted">Guided path · about 90 seconds</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Start here</h1>
        <p className="mt-2 text-muted">Five steps through a finished example. Nothing to sign up for.</p>

        <ol className="mt-8 divide-y divide-hairline overflow-hidden rounded-lg border border-rule bg-paper">
          {STEPS.map((s, i) => (
            <li key={s.title} className="grid grid-cols-[2rem_1fr] gap-x-4 px-5 py-5 sm:grid-cols-[2rem_1fr_auto] sm:items-center sm:px-6">
              <span className="font-mono text-sm tabular-nums text-muted">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h2 className="font-medium">{s.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">{s.body}</p>
              </div>
              <Link
                href={s.href}
                className={`col-start-2 mt-3 inline-flex w-fit items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors duration-150 sm:col-start-3 sm:mt-0 ${
                  i === 0 ? "border-ink bg-ink text-paper hover:bg-ink/85 active:bg-ink/75" : "border-rule hover:border-ink active:bg-concrete"
                }`}
              >
                {s.cta}
                <Chevron className="h-3 w-3" />
              </Link>
            </li>
          ))}
        </ol>
      </main>
    </>
  );
}
