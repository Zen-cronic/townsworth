// One figure and a short label; any explanation sits behind a disclosure.
export function StatTile({
  value,
  label,
  tone,
  more,
  children,
}: {
  value: React.ReactNode;
  label: string;
  tone?: "pen" | "ok";
  more?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="ui-stat">
      <p className={`ui-stat-v ${tone ? `is-${tone}` : ""}`}>{value}</p>
      <p className="ui-stat-k">{label}</p>
      {children}
      {more && (
        <details className="ui-more">
          <summary>Details</summary>
          <div>{more}</div>
        </details>
      )}
    </div>
  );
}
