// A headline figure: numbers in Plex Mono, joining words ("of", "vs") set small in the sans.
export function Figure({ value, className = "" }: { value: string; className?: string }) {
  const parts = value.split(/\s+(of|vs)\s+/);
  return (
    <span className={`font-mono font-medium tabular-nums tracking-tight ${className}`}>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <span key={i} className="mx-[0.3em] align-[0.12em] font-sans text-[0.5em] font-normal tracking-normal text-muted">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  );
}
