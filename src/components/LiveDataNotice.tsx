import Link from "next/link";
import { listNames } from "@/components/ui/labels";

// One line, shown only when some Qloo calls failed on this request: the figures beside it were
// computed from partial data. Renders nothing when every call answered.
export function LiveDataNotice({ towns, subject = "these figures", className = "" }: { towns: string[]; subject?: string; className?: string }) {
  if (!towns.length) return null;
  return (
    <p role="alert" className={`live-notice ${className}`}>
      <b>Live Qloo data didn&apos;t fully load for {listNames(towns)} on this visit,</b> so {subject} may be off. Reload to retry.{" "}
      <Link href="/proof#limits">Limits</Link>
    </p>
  );
}
