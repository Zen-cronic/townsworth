import type { BallotItem } from "@/lib/ballot";
import type { Bucket } from "@/lib/plan";

// The program area each idea comes from, as the memo names it.
const AREA: Partial<Record<Bucket, string>> = { grants: "Community fund grants", events: "Community events" };

export function AreaLabel({ item }: { item: BallotItem }) {
  const area = AREA[item.bucket];
  return area ? <p className="bl-area">{area}</p> : null;
}

// A grant's shared one-line gloss repeats on every grant, so grants show their area, partner and
// place instead; other ideas keep their own note.
export function itemNote(item: BallotItem): string | undefined {
  return item.bucket === "grants" ? undefined : item.note;
}

const distance = (kmValue: number) => {
  const mi = kmValue * 0.621371;
  const f = (n: number) => (n < 10 ? n.toFixed(1) : String(Math.round(n)));
  return `${f(kmValue)} km (${f(mi)} mi)`;
};

// Partner, place and distance. Never an amount: residents rank priorities, not budgets.
export function DistanceLine({ item, townName }: { item: BallotItem; townName: string }) {
  if (!item.partner) {
    return <p className="mt-1.5 text-sm leading-relaxed text-muted">Venue to be chosen with local hosts</p>;
  }
  return (
    <p className="mt-1.5 text-sm leading-relaxed text-muted">
      <span className="font-medium text-ink">{item.partner}</span>
      {item.place && <span className="break-words"> · {item.place}</span>}
      {item.distanceKm != null && (
        <span>
          {" · "}
          <span className="whitespace-nowrap tabular-nums">{distance(item.distanceKm)}</span> from central {townName}
        </span>
      )}
    </p>
  );
}
