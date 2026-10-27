// Small stroke icons drawn in the product's own 1.5px line. Decorative unless labelled.

type P = { className?: string };
const base = "shrink-0";

export function Chevron({ className = "h-3.5 w-3.5" }: P) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className={`${base} ${className}`}>
      <path d="M6 3.5 10.5 8 6 12.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronLeft({ className = "h-3.5 w-3.5" }: P) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className={`${base} ${className}`}>
      <path d="M10 3.5 5.5 8 10 12.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Check({ className = "h-3.5 w-3.5" }: P) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className={`${base} ${className}`}>
      <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Download({ className = "h-3.5 w-3.5" }: P) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className={`${base} ${className}`}>
      <path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Printer({ className = "h-3.5 w-3.5" }: P) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className={`${base} ${className}`}>
      <path d="M4.5 6V2.5h7V6M4.5 11.5H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1h-1.5M4.5 9.5h7v4h-7z" strokeLinejoin="round" />
    </svg>
  );
}

export function Notice({ className = "h-4 w-4" }: P) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className={`${base} ${className}`}>
      <path d="M8 2 14.5 13.5h-13z" strokeLinejoin="round" />
      <path d="M8 6.5v3.2M8 11.6v.1" strokeLinecap="round" />
    </svg>
  );
}
