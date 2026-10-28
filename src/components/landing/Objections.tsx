import Link from "next/link";
import { Chevron } from "./Chevron";
import type { HeroFacts } from "./heroFacts";

export interface Objection {
  q: string;
  a: string;
  href: string;
}

// Common questions, each answered by a deep link into the live product rather than a claim.
export function objectionsFor(f: HeroFacts, proof: { novelPct: number; changedPct: number; changedLine?: string }, sponsor: string): Objection[] {
  return [
    {
      q: "Who would buy this?",
      a: "The community-affairs lead who takes a costed program to the community committee. This is the memo they bring.",
      href: f.memoHref,
    },
    {
      q: "Couldn’t ChatGPT do this?",
      a: `AI alone mostly names the college, the district and the chamber. ${proof.novelPct}% of our local partners never appear in its plans.`,
      href: "/proof#finding-03",
    },
    {
      q: "Isn’t this just a nearby-places list?",
      a: `Ordering the same places by distance changes ${proof.changedPct}% of the picks${proof.changedLine ? ` (${proof.changedLine})` : ""}. Modest, and measured.`,
      href: "/proof#finding-04",
    },
    {
      q: "Does it strike real institutions?",
      a: f.institution
        ? `No. Line ${f.institution.line}, ${f.institution.name}, stays: institution, couldn’t verify here, so the committee confirms it.`
        : "No. Institutions the draft names stay, for the committee to confirm.",
      href: f.institution?.href ?? f.townHref,
    },
    {
      q: "Does this replace jobs, water or tax commitments?",
      a: "No. They open the memo, from cited public reporting. The program sits on top of them, never in their place.",
      href: `${f.memoHref}#commitments`,
    },
    {
      q: "Are the votes and dollars real?",
      a: "The tally is simulated and predicts nothing. Fund figures are illustrative until you enter your own.",
      href: `${f.resultsHref}#simulated`,
    },
    {
      q: "Who is paying for it?",
      a: `Every outreach draft and the resident ballot name the funder, here ${sponsor}.`,
      href: f.ballotHref,
    },
  ];
}

export function Objections({ items, id }: { items: Objection[]; id?: string }) {
  return (
    <ul className="lp-objections" id={id}>
      {items.map((o) => (
        <li key={o.q}>
          <Link href={o.href} className="lp-obj">
            <span className="lp-obj-q">{o.q}</span>
            <span className="lp-obj-a">{o.a}</span>
            <span className="lp-obj-see">
              See it <Chevron />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
