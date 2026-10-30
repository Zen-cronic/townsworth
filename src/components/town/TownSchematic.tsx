import type { PartnerPoint } from "@/components/charts/chartData";

// A site-plan sketch for the town header, drawn from the town's own data: the facility parcel at
// the centre, its coordinates and facility label, the 15 km search ring, and each named local
// partner placed at its real distance (the bearing is only spread for legibility). Server-rendered
// SVG; decorative, so the same facts stay in the page text.
const R = 15;
const size = 360;
const c = size / 2;
const ring = 150;

function spread(i: number, n: number) {
  return -Math.PI / 2 + (i + 0.5) * ((2 * Math.PI) / Math.max(n, 1)) + 0.35;
}

export function TownSchematic({ lat, lon, facility, points }: { lat: number; lon: number; facility: string; points: PartnerPoint[] }) {
  const known = points.filter((p) => p.distanceKm != null).slice(0, 12) as (PartnerPoint & { distanceKm: number })[];
  const coord = `${Math.abs(lat).toFixed(4)} ${lat >= 0 ? "N" : "S"}  ${Math.abs(lon).toFixed(4)} ${lon >= 0 ? "E" : "W"}`;
  return (
    <svg className="town-plan" viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
      <g className="town-plan-grid">
        <circle cx={c} cy={c} r={ring} />
        <circle cx={c} cy={c} r={ring * (10 / R)} />
        <circle cx={c} cy={c} r={ring * (5 / R)} />
        <line x1={c - ring - 10} y1={c} x2={c + ring + 10} y2={c} />
        <line x1={c} y1={c - ring - 10} x2={c} y2={c + ring + 10} />
      </g>
      <g className="town-plan-parcel">
        <polygon points={`${c - 26},${c - 14} ${c + 22},${c - 24} ${c + 30},${c + 14} ${c - 18},${c + 24}`} />
        <rect x={c - 12} y={c - 9} width={10} height={16} />
        <rect x={c + 2} y={c - 11} width={10} height={16} />
      </g>
      {known.map((p, i) => {
        const a = spread(i, known.length);
        const r = (Math.min(p.distanceKm, R) / R) * ring;
        return <circle key={p.name} className="town-plan-pt" cx={c + Math.cos(a) * r} cy={c + Math.sin(a) * r} r={4} />;
      })}
      <text className="town-plan-k" x={4} y={14}>
        {facility.toUpperCase()}
      </text>
      <text className="town-plan-v" x={4} y={28}>
        {coord}
      </text>
      <text className="town-plan-v" x={c + 6} y={c + ring * (5 / R) + 13}>
        5 KM
      </text>
      <text className="town-plan-v" x={c + 6} y={c + ring * (10 / R) + 13}>
        10 KM
      </text>
      <text className="town-plan-v" x={c + 6} y={c + ring + 13}>
        15 KM
      </text>
    </svg>
  );
}
