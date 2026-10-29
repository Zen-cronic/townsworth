import Link from "next/link";
import { Figure } from "@/components/dashboard/Figure";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { LENSES, type LensStatus, type ReachSummary } from "@/lib/reach";

// /proof row for the age-group check, across the evidence towns. The partner figures above never
// include these sessions.

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Cell({ status, place, ranked }: { status?: LensStatus; place?: string; ranked?: number }) {
  if (!status) return <span className="text-muted">-</span>;
  if (status === "covered") return <StatusPill tone="ok">Included</StatusPill>;
  if (status === "added")
    return (
      <span className="flex flex-col items-start gap-1">
        <StatusPill tone="ok">Added</StatusPill>
        <span className="text-xs text-muted">{place}</span>
      </span>
    );
  if (status === "unchecked") return <StatusPill tone="neutral">Couldn&apos;t check</StatusPill>;
  return (
    <span className="flex flex-col items-start gap-1">
      <StatusPill tone="flag">Not reached</StatusPill>
      <span className="text-xs text-muted">{status === "no-fit" ? `${place}: reserve too small` : ranked === 0 ? "No places ranked" : "No eligible host"}</span>
    </span>
  );
}

export function ReachProof({ towns }: { towns: { slug: string; name: string; reach: ReachSummary }[] }) {
  const checks = towns.reduce((s, t) => s + t.reach.lenses.length, 0);
  const included = towns.reduce((s, t) => s + t.reach.covered.length, 0);
  const added = towns.reduce((s, t) => s + t.reach.added.length, 0);
  const townsAdded = towns.filter((t) => t.reach.added.length).length;
  const unchecked = towns.reduce((s, t) => s + t.reach.unchecked, 0);
  const notReached = checks - included - unchecked - towns.reduce((s, t) => s + t.reach.lenses.filter((l) => l.status === "added").length, 0);
  if (!checks) return null;
  return (
    <section id="age-groups" aria-labelledby="age-groups-title" className="mt-6 scroll-mt-24 ui-card">
      <div className="grid gap-4 border-b border-rule px-5 py-5 sm:grid-cols-[auto_1fr] sm:items-start sm:gap-6 sm:px-6">
        <p className="text-[2.25rem] leading-none">
          <Figure value={String(added)} />
        </p>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-contour">Age groups · Qloo</p>
          <h2 id="age-groups-title" className="mt-1 font-semibold">
            Venues the age lenses add that the town-wide ranking doesn&apos;t
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {added === 0 ? "None in this run" : `${added} ${added === 1 ? "venue" : "venues"} in ${townsAdded} ${townsAdded === 1 ? "town" : "towns"}`}.{" "}
            {included} of {checks} age-group checks were already met by the program as drafted
            {notReached > 0 ? `; ${notReached} had no host the program could add` : ""}
            {unchecked > 0 ? `; ${unchecked} couldn't be checked on this load` : ""}. Qloo ranks the places within 15 km for young adults (under
            25), older residents and families with young children; a group is included when a program venue or grant applicant is in its top
            15. Added sessions are earmarked from the reserve and change no figure above.{" "}
            <Link href="#limits" className="underline decoration-rule underline-offset-2 hover:text-ink">
              Limits
            </Link>
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-hairline text-[11px] uppercase tracking-wider text-muted">
              <th scope="col" className="px-4 py-2.5 pl-5 text-left font-medium sm:pl-6">Town</th>
              {LENSES.map((l) => (
                <th key={l.key} scope="col" className="px-4 py-2.5 text-left font-medium last:pr-6">
                  {sentence(l.label)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {towns.map((t) => (
              <tr key={t.slug}>
                <td className="px-4 py-3 pl-5 align-top font-medium sm:pl-6">{t.name}</td>
                {LENSES.map((l) => {
                  const o = t.reach.lenses.find((x) => x.key === l.key);
                  return (
                    <td key={l.key} className="px-4 py-3 align-top last:pr-6">
                      <Cell status={o?.status} place={o?.place} ranked={o?.ranked} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
