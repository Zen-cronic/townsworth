import Link from "next/link";
import { listNames } from "@/components/ui/labels";

// One line, shown only when some Qloo calls failed on this request: the figures beside it were
// computed from partial data. Renders nothing when every call answered. A status, not an alert:
// it describes the page as loaded, so it shouldn't interrupt a screen reader on arrival.
// With `reloadHref`, "Try again" is a full page load of that address; with `retry`, a full load of
// this page. The answers that did load are kept (src/lib/qloo.ts), so a retry asks only for the rest.
export function LiveDataNotice({
  towns,
  subject = "these figures",
  className = "",
  reloadHref,
  retry = false,
}: {
  towns: string[];
  subject?: string;
  className?: string;
  reloadHref?: string;
  retry?: boolean;
}) {
  if (!towns.length) return null;
  return (
    <p role="status" className={`live-notice ${className}`}>
      <b>Live Qloo data didn&apos;t fully load for {listNames(towns)} on this visit,</b> so {subject} may be off.{" "}
      {reloadHref || retry ? (
        <>
          {/* An empty href is this page's own address, without the fragment: a full load. */}
          <a href={reloadHref ?? ""}>Try again</a>: what loaded is kept, so a retry only asks for the rest.
        </>
      ) : (
        "Reload to retry."
      )}{" "}
      <Link href="/proof#limits">Limits</Link>
    </p>
  );
}
