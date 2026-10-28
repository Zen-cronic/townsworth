// Calendar deep links for scheduled program sessions. Server-safe: no hooks, no client state.

import { googleCalendarUrl, itemSessions, outlookCalendarUrl, sessionEvent } from "@/lib/integrations";
import type { ProgramItem } from "@/lib/plan";
import type { Town } from "@/lib/towns";

type TownPlace = Pick<Town, "name" | "region">;

const linkClass = "text-muted underline decoration-rule underline-offset-4 transition-colors duration-150 hover:text-ink hover:decoration-ink";

const dateLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function ExternalLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${label} (opens in a new tab)`} className={linkClass}>
      {children}
      <span aria-hidden> ↗</span>
    </a>
  );
}

export interface SessionCalendarLinksProps {
  item: ProgramItem;
  town: TownPlace;
  // Only the first scheduled session. Defaults to every session.
  firstOnly?: boolean;
  // Reference date for "month 1"; the .ics export uses the request time.
  now?: Date;
  className?: string;
}

export function SessionCalendarLinks({ item, town, firstOnly = false, now, className = "" }: SessionCalendarLinksProps) {
  const sessions = itemSessions(item, now);
  const shown = firstOnly ? sessions.slice(0, 1) : sessions;
  if (!shown.length) return null;
  return (
    <ul aria-label={`Calendar links for ${item.title}`} className={`no-print flex flex-col gap-1 text-xs ${className}`}>
      {shown.map((s) => {
        const event = sessionEvent(item, s, town);
        const when = dateLabel.format(s.start);
        return (
          <li key={s.index} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {shown.length > 1 || firstOnly ? <span className="font-mono tabular-nums text-muted">{when}</span> : null}
            <ExternalLink href={googleCalendarUrl(event)} label={`Add the ${when} session to Google Calendar`}>
              Add to Google Calendar
            </ExternalLink>
            <ExternalLink href={outlookCalendarUrl(event)} label={`Add the ${when} session to Outlook`}>
              Outlook
            </ExternalLink>
          </li>
        );
      })}
    </ul>
  );
}

export interface ProgramCalendarLinksProps {
  items: ProgramItem[];
  town: TownPlace;
  now?: Date;
  className?: string;
}

// The first session of each scheduled item, one row per item.
export function ProgramCalendarLinks({ items, town, now, className = "" }: ProgramCalendarLinksProps) {
  const scheduled = items.filter((it) => it.months.length > 0);
  if (!scheduled.length) return null;
  return (
    <ul aria-label="Add sessions to a calendar" className={`no-print divide-y divide-hairline text-sm ${className}`}>
      {scheduled.map((it) => (
        <li key={it.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
          <span className="min-w-0">{it.title}</span>
          <SessionCalendarLinks item={it} town={town} now={now} firstOnly />
        </li>
      ))}
    </ul>
  );
}
