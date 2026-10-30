import type { PartnerPoint } from "./chartData";

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
        <caption>Local partners by how much locals favour them (Qloo), with distance from the site</caption>
        <thead>
          <tr>
            <th scope="col">Partner</th>
            <th scope="col">Rank among places locals favour</th>
            <th scope="col">Distance</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.name}>
              <th scope="row">{p.name}</th>
              <td>{p.affinityRank != null ? `#${p.affinityRank}` : "not ranked by Qloo"}</td>
              <td>{p.distanceKm != null ? kmLabel(p.distanceKm) : "unknown"}</td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </figure>
  );
}

// The nearest named local partners: plain text a reader can scan, with the distance beside each.
export function PartnerNames({ points, show = 3 }: { points: PartnerPoint[]; show?: number }) {
  const known = (points.filter((p) => p.distanceKm != null) as (PartnerPoint & { distanceKm: number })[]).sort((a, b) => a.distanceKm - b.distanceKm);
  if (!known.length) return null;
  return (
    <ul className="ch-names" aria-label="Nearest local partners">
      {known.slice(0, show).map((p) => (
        <li key={p.name}>
          <span className="ch-names-n">{p.name}</span>
          <span className="ch-names-d">{kmLabel(p.distanceKm)}</span>
        </li>
      ))}
    </ul>
  );
}
