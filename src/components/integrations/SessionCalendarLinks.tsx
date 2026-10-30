// Calendar deep links for scheduled program sessions. Server-safe: no hooks, no client state.

import { googleCalendarUrl, itemSessions, outlookCalendarUrl, sessionEvent } from "@/lib/integrations";
import type { ProgramItem } from "@/lib/plan";
import type { Town } from "@/lib/towns";

type TownPlace = Pick<Town, "name" | "region">;

// A small outlined button: each link adds an event or opens a compose window, so it reads as an action.
const linkClass =
  "inline-flex min-h-8 items-center rounded-md border border-rule bg-paper px-2.5 font-medium text-ink transition-colors duration-150 hover:border-ink active:bg-concrete";

const dateLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

// The accessible name starts with the visible text (so "click Add to Outlook" works by voice), then
// says what the link is for and that it opens a new tab; the tooltip says so too.
export function ExternalLink({ href, text, context, children }: { href: string; text: string; context: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${text}: ${context} (opens in a new tab)`}
      title="Opens in a new tab"
      className={linkClass}
    >
      {children}
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
          <li key={s.index} className="flex flex-wrap items-center gap-2">
            {shown.length > 1 || firstOnly ? <span className="font-mono tabular-nums text-muted">{when}</span> : null}
            <ExternalLink href={googleCalendarUrl(event)} text="Add to Google Calendar" context={`the ${when} session`}>
              Add to Google Calendar
            </ExternalLink>
            <ExternalLink href={outlookCalendarUrl(event)} text="Add to Outlook" context={`the ${when} session`}>
              Add to Outlook
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
        <li key={it.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2">
          <span className="min-w-0">{it.title}</span>
          <SessionCalendarLinks item={it} town={town} now={now} firstOnly />
        </li>
      ))}
    </ul>
  );
}
