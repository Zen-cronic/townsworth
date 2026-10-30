import type { BallotItem } from "@/lib/ballot";

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
