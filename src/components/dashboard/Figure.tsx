// A headline figure in one face (Plex Mono, tabular); joining words ("of", "vs") are smaller and muted.
export function Figure({ value, className = "" }: { value: string; className?: string }) {
  const parts = value.split(/\s+(of|vs)\s+/);
  return (
    <span className={`font-mono font-medium tabular-nums tracking-tight ${className}`}>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <span key={i} className="mx-[0.25em] text-[0.55em] font-normal tracking-normal text-muted">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  );
}
