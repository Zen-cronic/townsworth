import type { PartnerPoint } from "@/components/charts/chartData";

// A site-plan sketch for a page header, drawn from the town's own data: the facility parcel at
// the centre, its coordinates and facility label, three distance rings scaled to the actual
// spread of the named partners, and each partner at its real distance (the bearing is only
// spread for legibility, and skips the axis that carries the ring labels). Server-rendered and
// decorative; the same facts are in the page text.
const size = 320;
const c = size / 2;
const ring = 128;
const SCALES = [1, 2, 5, 10, 15];
// The ring labels sit straight below the centre; markers keep clear of that axis.
const LABEL_AXIS = Math.PI / 2;
const CLEAR = 0.42;

function bearing(i: number, n: number) {
  const span = 2 * Math.PI - 2 * CLEAR;
  return LABEL_AXIS + CLEAR + ((i + 0.5) / Math.max(n, 1)) * span;
}

const fmt = (km: number) => (km < 1 ? `${Math.round(km * 1000)} M` : `${Number.isInteger(km) ? km : km.toFixed(1)} KM`);

export function TownSchematic({ lat, lon, facility, points }: { lat: number; lon: number; facility: string; points: PartnerPoint[] }) {
  const known = points.filter((p) => p.distanceKm != null).slice(0, 12) as (PartnerPoint & { distanceKm: number })[];
  const far = Math.max(0, ...known.map((p) => p.distanceKm));
  const R = known.length ? (SCALES.find((s) => s >= far * 1.15) ?? 15) : 15;
  const rings = [R / 3, (2 * R) / 3, R];
  const coord = `${Math.abs(lat).toFixed(4)} ${lat >= 0 ? "N" : "S"}  ${Math.abs(lon).toFixed(4)} ${lon >= 0 ? "E" : "W"}`;
  return (
    <div className="town-plan-wrap" aria-hidden="true">
      <p className="town-plan-label">
        <b>{facility.toUpperCase()}</b>
        <span>{coord}</span>
      </p>
      <svg className="town-plan" viewBox={`0 0 ${size} ${size}`} focusable="false">
        <g className="town-plan-grid">
          {rings.map((r, i) => (
            <circle key={r} cx={c} cy={c} r={(r / R) * ring} className={i === rings.length - 1 ? "is-outer" : undefined} />
          ))}
          <line x1={c - ring - 8} y1={c} x2={c + ring + 8} y2={c} />
          <line x1={c} y1={c - ring - 8} x2={c} y2={c + ring + 8} />
        </g>
        <g className="town-plan-parcel">
          <polygon points={`${c - 22},${c - 12} ${c + 18},${c - 20} ${c + 25},${c + 12} ${c - 15},${c + 20}`} />
          <rect x={c - 10} y={c - 8} width={8} height={13} />
          <rect x={c + 2} y={c - 9} width={8} height={13} />
        </g>
        {known.map((p, i) => {
          const a = bearing(i, known.length);
          // Never closer than the parcel edge, so a marker on the site still reads.
          const r = Math.max(30, (Math.min(p.distanceKm, R) / R) * ring);
          return <circle key={p.name} className="town-plan-pt" cx={c + Math.cos(a) * r} cy={c + Math.sin(a) * r} r={4} />;
        })}
        {rings.map((r) => (
          <text key={r} className="town-plan-v" x={c + 5} y={c + (r / R) * ring - 4}>
            {fmt(r)}
          </text>
        ))}
      </svg>
    </div>
  );
}
