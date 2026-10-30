import Link from "next/link";
import { listNames } from "@/components/ui/labels";

// One line, shown only when some Qloo calls failed on this request: the figures beside it were
// computed from partial data. Renders nothing when every call answered. A status, not an alert:
// it describes the page as loaded, so it shouldn't interrupt a screen reader on arrival.
// With `reloadHref`, "Reload" is a full page load of that address.
export function LiveDataNotice({
  towns,
  subject = "these figures",
  className = "",
  reloadHref,
}: {
  towns: string[];
  subject?: string;
  className?: string;
  reloadHref?: string;
}) {
  if (!towns.length) return null;
  return (
    <p role="status" className={`live-notice ${className}`}>
      <b>Live Qloo data didn&apos;t fully load for {listNames(towns)} on this visit,</b> so {subject} may be off.{" "}
      {reloadHref ? <a href={reloadHref}>Reload</a> : "Reload"} to retry. <Link href="/proof#limits">Limits</Link>
    </p>
  );
}
