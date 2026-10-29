import Link from "next/link";
import { Chevron } from "@/components/landing/Chevron";

// The primary action: an ink button with a small paper square holding the arrow.
// `quiet` is the paper secondary with no square.
export function SplitCta({
  href,
  children,
  quiet,
  prefetch,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  quiet?: boolean;
  prefetch?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} prefetch={prefetch} className={`lp-btn ${quiet ? "lp-btn-quiet" : "lp-btn-primary"} ${className}`}>
      {children}
      {!quiet && (
        <span className="lp-btn-sq" aria-hidden="true">
          <Chevron />
        </span>
      )}
    </Link>
  );
}
