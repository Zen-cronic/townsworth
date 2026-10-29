// Four short phrases; the full guardrails are in the memo and on the sources page.
const RAILS = ["Jobs, water, power and tax come first", "Not tied to any vote or permit", "Residents set the order", "No profiling of individuals"];

export function Guardrails() {
  return (
    <div className="lp-rails" id="guardrails">
      <h3 className="lp-kicker" id="rails-h">
        Guardrails, built in
      </h3>
      <ul className="lp-rail-list">
        {RAILS.map((r) => (
          <li key={r}>
            <p className="lp-h3">{r}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
