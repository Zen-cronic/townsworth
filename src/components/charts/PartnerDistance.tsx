import { stackDots, type PartnerPoint } from "./chartData";

const kmLabel = (n: number) => `${n < 10 ? n.toFixed(1) : Math.round(n)} km`;

// Local partners ranked by Qloo affinity, each placed on a shared distance-from-site scale.
// A hollow dot is a place Qloo listed by distance only, with no affinity score.
export function PartnerDistance({ points }: { points: PartnerPoint[] }) {
  const far = Math.max(15, ...points.map((p) => p.distanceKm ?? 0));
  const max = Math.ceil(far / 5) * 5;
  const pos = (km: number) => `${(Math.min(km, max) / max) * 100}%`;
  const ticks = Array.from({ length: max / 5 + 1 }, (_, i) => i * 5);
  return (
    <figure className="ch-anim">
      <div className="ch-dots" aria-hidden>
        {points.map((p) => (
          <div key={p.name} className="ch-dots-row">
            <span className="ch-dots-name" title={p.name}>
              {p.name.split(" | ")[0]}
            </span>
            <span className="ch-track">
              {p.distanceKm != null && (
                <>
                  <span className={`ch-dot ${p.affinityRank == null ? "is-unranked" : ""}`} style={{ left: pos(p.distanceKm) }} title={kmLabel(p.distanceKm)} />
                </>
              )}
            </span>
            <span className={`ch-dots-rank ${p.affinityRank == null ? "is-none" : ""}`}>{p.affinityRank != null ? `#${p.affinityRank}` : "no rank"}</span>
          </div>
        ))}
        <div className="ch-dots-row ch-dots-axis border-b-0" style={{ minHeight: 0 }}>
          <span />
          <span className="ch-axis">
            {ticks.map((t) => (
              <span key={t} style={{ left: pos(t) }}>
                {t === max ? `${t} km` : t}
              </span>
            ))}
          </span>
          <span />
        </div>
      </div>
      <div className="sr-only">
        <table>
        <caption>Local partners by Qloo affinity rank, with distance from the site</caption>
        <thead>
          <tr>
            <th scope="col">Partner</th>
            <th scope="col">Affinity rank</th>
            <th scope="col">Distance</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.name}>
              <th scope="row">{p.name}</th>
              <td>{p.affinityRank != null ? `#${p.affinityRank}` : "no affinity score"}</td>
              <td>{p.distanceKm != null ? kmLabel(p.distanceKm) : "unknown"}</td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </figure>
  );
}

// Compact form: every place as a dot on one distance track. Dots that would overlap stack into
// a second or third row, so each place keeps a visible mark; scored places draw above unscored.
export function PartnerDotStrip({ points }: { points: PartnerPoint[] }) {
  const known = points.filter((p) => p.distanceKm != null) as (PartnerPoint & { distanceKm: number })[];
  if (!known.length) return null;
  const far = Math.max(15, ...known.map((p) => p.distanceKm));
  const max = Math.ceil(far / 5) * 5;
  const pos = (km: number) => `${(Math.min(km, max) / max) * 100}%`;
  const near = Math.min(...known.map((p) => p.distanceKm));
  const farthest = Math.max(...known.map((p) => p.distanceKm));
  const placed = stackDots(known.map((p) => p.distanceKm / max), 0.06).map((lane, i) => ({ p: known[i], lane }));
  const lanes = Math.max(...placed.map((d) => d.lane)) + 1;
  const items = known.reduce((s, p) => s + p.items, 0);
  return (
    <figure className="ch-anim" aria-label={`${known.length} places between ${kmLabel(near)} and ${kmLabel(farthest)} from the site`}>
      <span className="ch-swarm block" style={{ height: 8 + lanes * 16 }} aria-hidden>
        {placed
          .sort((a, b) => Number(a.p.affinityRank != null) - Number(b.p.affinityRank != null))
          .map(({ p, lane }) => (
            <span
              key={p.name}
              className={`ch-dot ${p.affinityRank == null ? "is-unranked" : ""}`}
              style={{ left: pos(p.distanceKm), top: `${lanes * 16 - lane * 16}px` }}
              title={`${p.name}: ${kmLabel(p.distanceKm)}`}
            />
          ))}
      </span>
      <figcaption className="mt-1.5 flex flex-wrap justify-between gap-x-3 font-mono text-[11px] tabular-nums text-muted" aria-hidden>
        <span>
          {items > known.length ? `at ${known.length} places` : `${known.length} ${known.length === 1 ? "place" : "places"}`} · {kmLabel(near)}–{kmLabel(farthest)}
        </span>
        <span>0–{max} km from site</span>
      </figcaption>
    </figure>
  );
}
