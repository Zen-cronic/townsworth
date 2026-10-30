import type { Spec } from "./specs";

// Cited material commitments for the example town: the floor every program sits on.
export function SpecBand({ specs, town, asOf }: { specs: Spec[]; town: string; asOf: string }) {
  return (
    <ul className="lp-specs" data-reveal="" aria-label={`Material commitments for ${town}`}>
      {specs.map((s) => (
        <li key={s.topic} className="lp-spec" data-topic={s.topic.toLowerCase()}>
          <p className="lp-spec-k">{s.topic}</p>
          <p className="lp-spec-v">
            {s.value} <span>{s.unit}</span>
          </p>
          <p className="lp-spec-note">{s.note}</p>
          <p className="lp-spec-src">
            Source:{" "}
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.source}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </p>
        </li>
      ))}
      <li className="lp-spec-foot">
        As of {asOf}.{" "}
        <a href="/sources#commitments" className="lp-textlink">
          All sources
        </a>
      </li>
    </ul>
  );
}
