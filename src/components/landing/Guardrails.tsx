import { PRODUCT_NAME } from "./brand";

const RAILS = [
  {
    title: "Jobs, water, power and tax come first",
    body: "They are the developer’s commitments, from cited reporting or its filings. Programs sit on top of them, never in place of them.",
  },
  {
    title: "Not tied to any vote or permit",
    body: "Nothing is timed around a vote, a hearing or a permit. The goal is programs residents would use.",
  },
  {
    title: "Residents set the order",
    body: `${PRODUCT_NAME} proposes a shortlist. Residents rank it, and the community committee decides what gets funded.`,
  },
  {
    title: "No profiling of individuals",
    body: "No political, religious or identity signals. Taste data is aggregate for the town, never about a person.",
  },
];

export function Guardrails() {
  return (
    <div className="lp-rails" id="guardrails">
        <h3 className="lp-kicker" id="rails-h">
          Guardrails, built in
        </h3>
        <ul className="lp-rail-list">
          {RAILS.map((r) => (
            <li key={r.title}>
              <h3 className="lp-h3">{r.title}</h3>
              <p>{r.body}</p>
            </li>
          ))}
        </ul>
    </div>
  );
}
