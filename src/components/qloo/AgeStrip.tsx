import { AGE_BUCKETS, AGE_LABEL, ageLine, ageSkewLabel, type AgeProfile } from "@/lib/qlooInsights";

// A partner's audience age profile from Qloo: six small bars, youngest to oldest, rising above the
// line where the place's audience over-indexes on the group and dipping below where it under-indexes,
// with the reading beside them. Aggregate affinity for the people who favour the place, never a
// visitor count. Renders nothing when Qloo has no profile for the place.

const W = 7;
const GAP = 2;
const MID = 10;
const REACH = 9;
// Bars reach full height at an affinity of 0.5 either way; anything beyond is drawn at full height.
const FULL = 0.5;

const signed = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}`;

export function AgeStrip({ ages, className = "" }: { ages?: AgeProfile; className?: string }) {
  const line = ageLine(ages);
  if (!ages || !line) return null;
  const top = ageSkewLabel(ages);
  const width = AGE_BUCKETS.length * (W + GAP) - GAP;
  const described = AGE_BUCKETS.map((b) => `${AGE_LABEL[b]} ${signed(ages[b])}`).join(", ");
  return (
    <p data-age-strip className={`flex items-center gap-2 ${className}`}>
      <svg
        role="img"
        aria-label={`Qloo audience age affinity, youngest to oldest: ${described}`}
        viewBox={`0 0 ${width} ${MID * 2}`}
        width={width}
        height={MID * 2}
        className="shrink-0"
      >
        <line x1={0} x2={width} y1={MID} y2={MID} stroke="currentColor" strokeOpacity={0.35} strokeWidth={1} />
        {AGE_BUCKETS.map((b, i) => {
          const v = Math.max(-1, Math.min(1, ages[b]));
          const h = Math.max(1.5, Math.min(1, Math.abs(v) / FULL) * REACH);
          const isTop = AGE_LABEL[b] === top;
          return (
            <rect
              key={b}
              x={i * (W + GAP)}
              y={v >= 0 ? MID - h : MID}
              width={W}
              height={h}
              rx={1}
              fill="currentColor"
              fillOpacity={v < 0 ? 0.3 : isTop ? 1 : 0.65}
            >
              <title>{`${AGE_LABEL[b]}: ${signed(ages[b])}`}</title>
            </rect>
          );
        })}
      </svg>
      {/* A non-breaking hyphen, so a narrow card never splits "over-indexes" across two lines. */}
      <span>{line.replace("over-indexes", "over\u2011indexes")}</span>
    </p>
  );
}
