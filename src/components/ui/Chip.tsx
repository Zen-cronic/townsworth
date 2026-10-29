// A small mono label. "ok" carries the survey-blue dot (kept, added, a local signal);
// "pen" is the orange of a struck line; "warn" an illustrative or simulated figure.
export function Chip({ children, tone = "ok", className = "" }: { children: React.ReactNode; tone?: "ok" | "pen" | "warn" | "plain"; className?: string }) {
  return (
    <span className={`ui-chip is-${tone} ${className}`}>
      {tone !== "plain" && <span aria-hidden="true" className="ui-chip-dot" />}
      {children}
    </span>
  );
}
