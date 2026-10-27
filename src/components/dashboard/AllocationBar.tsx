import { BUCKETS, type Bucket } from "@/lib/plan";
import { money } from "@/lib/run";

// Charcoal steps keep the split calm; orange stays reserved for marks.
const SHADE: Record<Bucket, string> = {
  training: "bg-ink",
  procurement: "bg-ink/70",
  grants: "bg-ink/45",
  events: "bg-ink/25",
  channels: "bg-rule",
};

export function AllocationBar({ totals, total }: { totals: { b: Bucket; amount: number }[]; total: number }) {
  const parts = totals.filter((t) => t.amount > 0);
  return (
    <div>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Budget split by program area">
        {parts.map((t) => (
          <span key={t.b} className={SHADE[t.b]} style={{ width: `${(t.amount / Math.max(total, 1)) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2 lg:grid-cols-3">
        {parts.map((t) => (
          <li key={t.b} className="flex items-center gap-2">
            <span aria-hidden className={`h-2 w-2 rounded-sm ${SHADE[t.b]}`} />
            <span className="text-muted">{BUCKETS[t.b].label}</span>
            <span className="ml-auto font-mono tabular-nums text-ink sm:ml-0">{money(t.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
