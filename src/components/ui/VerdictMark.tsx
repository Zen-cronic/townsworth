// The one verdict vocabulary: a cross for "Not local", a dotted ring for "Can't confirm", a solid
// ring for "Kept". Used in legends, filters, row markers, chips and beside kept names. Decorative:
// the verdict is always also written in words.
export type Verdict = "generic" | "unsure" | "kept";

export function VerdictMark({ kind, className = "" }: { kind: Verdict; className?: string }) {
  return <span aria-hidden="true" className={`vmark is-${kind} ${className}`} />;
}
