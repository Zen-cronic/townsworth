import { StatusPill } from "@/components/dashboard/StatusPill";
import { Card } from "@/components/ui";
import type { LensOutcome, LensStatus } from "@/lib/reach";

// Age-group check for one town: does the program include places each group already uses?
// Server component; reads `program.reach` as set by applyReach.

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const PILL: Record<LensStatus, { tone: "ok" | "flag" | "neutral"; text: string }> = {
  covered: { tone: "ok", text: "Included" },
  added: { tone: "ok", text: "Added" },
  "no-fit": { tone: "flag", text: "Not reached" },
  "no-candidate": { tone: "flag", text: "Not reached" },
  unchecked: { tone: "neutral", text: "Couldn't check" },
};

function Detail({ o }: { o: LensOutcome }) {
  if (o.status === "covered" && o.partners?.length) {
    const [first, ...rest] = o.partners;
    return (
      <>
        <span className="font-medium text-ink">{first.name}</span>
        <span className="text-muted">
          {" "}
          is #{first.lensRank} of the places this group favours most{rest.length ? `, with ${rest.length} more of the program's partners` : ""}.
        </span>
      </>
    );
  }
  if (o.status === "added" && o.place) {
    return (
      <>
        <span className="font-medium text-ink">{o.place.name}</span>
        <span className="text-muted">
          {" "}
          is #{o.place.lensRank} for this group and no partner was. One open session added there
          {o.amount ? `, ${usd(o.amount)} earmarked from the reserve` : ""}.
        </span>
      </>
    );
  }
  return <span className="text-muted">{o.note}</span>;
}

export function AudienceReach({ reach, className = "" }: { reach?: LensOutcome[]; className?: string }) {
  if (!reach?.length) return null;
  const included = reach.filter((o) => o.status === "covered").length;
  return (
    <Card as="section" aria-labelledby="reach-title" className={`overflow-hidden ${className}`}>
      <div className="border-b border-rule px-5 py-4 sm:px-6">
        <p className="font-mono text-[11px] uppercase tracking-wider text-contour">Age groups · Qloo</p>
        <h2 id="reach-title" className="mt-1 font-semibold">
          Does the program include places the town&apos;s age groups use?
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {included === reach.length
            ? "Yes, for all three groups, as drafted."
            : `Included as drafted for ${included} of ${reach.length} groups.`}
        </p>
      </div>
      <ul className="divide-y divide-hairline">
        {reach.map((o) => (
          <li key={o.key} className="grid gap-1.5 px-5 py-3.5 sm:grid-cols-[13rem_7.5rem_1fr] sm:items-baseline sm:gap-4 sm:px-6">
            <span className="text-sm font-medium">{sentence(o.label)}</span>
            <span>
              <StatusPill tone={PILL[o.status].tone}>{PILL[o.status].text}</StatusPill>
            </span>
            <span className="text-sm leading-snug">
              <Detail o={o} />
            </span>
          </li>
        ))}
      </ul>
      <details className="ui-more border-t border-hairline px-5 py-3 sm:px-6">
        <summary>How this is checked</summary>
        <div>
          Qloo ranks the places within 15 km of the site for each group from aggregate data; no resident is scored. A group is included when
          one of the program&apos;s venues or grant applicants is among its top 15. If none is, one session is added at the group&apos;s
          best-ranked hall, library, park, museum, zoo, school or college, earmarked from the reserve, or skipped if the reserve can&apos;t cover it. The program totals above don&apos;t include it.
          A bar or brewery partner doesn&apos;t count for families or young adults.
        </div>
      </details>
    </Card>
  );
}
