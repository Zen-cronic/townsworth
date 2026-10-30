// A small label. "ok" carries the lime kept mark (kept, added, a local signal); "pen" is the pink of a
// struck line; "unsure" a struck line that couldn't be confirmed (dashed, open mark); "warn" an
// illustrative or simulated figure.
export function Chip({ children, tone = "ok", className = "" }: { children: React.ReactNode; tone?: "ok" | "pen" | "unsure" | "warn" | "plain"; className?: string }) {
  return (
    <span className={`ui-chip is-${tone} ${className}`}>
      {tone !== "plain" && <span aria-hidden="true" className="ui-chip-dot" />}
      {children}
    </span>
  );
}
