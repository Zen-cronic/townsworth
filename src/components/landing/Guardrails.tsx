const RAILS = [
  {
    title: "Material commitments come first",
    body: "Jobs, power, water, noise and tax are the developer’s commitments, entered from its filings. Programs sit on top of them, never in place of them.",
  },
  {
    title: "Not persuasion",
    body: "Nothing is timed around a vote, a hearing or a permit. The goal is programs residents would use, not a change of mind.",
  },
  {
    title: "Residents rank",
    body: "Good Neighbor proposes a shortlist. The community committee ranks it and decides what gets funded.",
  },
  {
    title: "No targeting",
    body: "No political, religious or identity signals. Signals are aggregate for the town, never about individuals.",
  },
];

export function Guardrails() {
  return (
    <section className="lp-section lp-rails" aria-labelledby="rails-h">
      <div className="lp-wrap">
        <p className="lp-kicker" id="rails-h">
          Guardrails, built in
        </p>
        <ul className="lp-rail-list">
          {RAILS.map((r) => (
            <li key={r.title}>
              <h3 className="lp-h3">{r.title}</h3>
              <p>{r.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
