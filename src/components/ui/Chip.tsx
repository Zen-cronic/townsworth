import { VerdictMark } from "./VerdictMark";

// A small label. "ok" carries the green kept mark (kept, added, a local signal); "pen" is the pink of a
// struck line; "unsure" a struck line that couldn't be confirmed (dashed, open mark); "warn" an
// illustrative or simulated figure; "qloo" a value read from Qloo's local signal (an affinity rank),
// solid blue with no mark; "plain" a neutral outline.
export function Chip({ children, tone = "ok", className = "" }: { children: React.ReactNode; tone?: "ok" | "pen" | "unsure" | "warn" | "plain" | "qloo"; className?: string }) {
  return (
    <span className={`ui-chip is-${tone} ${className}`}>
      {tone === "pen" ? (
        <VerdictMark kind="generic" />
      ) : tone === "unsure" ? (
        <VerdictMark kind="unsure" />
      ) : tone === "ok" ? (
        <VerdictMark kind="kept" />
      ) : tone !== "plain" && tone !== "qloo" ? (
        <span aria-hidden="true" className="ui-chip-dot" />
      ) : null}
      {children}
    </span>
  );
}
