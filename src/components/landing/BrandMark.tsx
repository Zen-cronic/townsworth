// The Townsworth homestead mark: a blue open frame (the town) holding a green house (what it keeps).
// Colours come from the palette tokens, with the literal values as a fallback. Decorative only;
// the wordmark beside it stays live text.
export function BrandMark({ size = 22, className = "" }: { size?: number; className?: string }) {
  const frame = "var(--band, #2450d8)";
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
    >
      <rect x="6" y="6" width="52" height="6" fill={frame} />
      <rect x="6" y="6" width="6" height="52" fill={frame} />
      <rect x="52" y="6" width="6" height="52" fill={frame} />
      <rect x="6" y="52" width="18" height="6" fill={frame} />
      <rect x="40" y="52" width="18" height="6" fill={frame} />
      <path d="M22 34L32 24L42 34L42 46L22 46Z" fill="var(--ok, #143d2a)" />
    </svg>
  );
}
