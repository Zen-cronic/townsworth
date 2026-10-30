import { itemSessions, sessionDescription, sessionStart, utcStamp } from "../../../lib/integrations";
import type { ProgramItem } from "../../../lib/plan";

// RFC 5545 helpers: TEXT escaping (section 3.3.11) and 75-octet line folding (section 3.1).

export function icsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
}

const octets = (s: string) => new TextEncoder().encode(s).length;

export function foldLine(line: string): string {
  if (octets(line) <= 75) return line;
  const parts: string[] = [];
  let cur = "";
  let limit = 75;
  for (const ch of line) {
    if (octets(cur + ch) > limit) {
      parts.push(cur);
      cur = "";
      // Continuation lines start with a space, which counts toward their 75 octets.
      limit = 74;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts.join("\r\n ");
}

// One VEVENT per scheduled session. Dates come from the same helpers as the calendar links.
export function programIcs(slug: string, items: ProgramItem[], now: Date = new Date()): string {
  const events = items.flatMap((it) =>
    itemSessions(it, now).map((s) =>
      [
        "BEGIN:VEVENT",
        `UID:${slug}-${it.id}-${s.index}@good-neighbor`,
        `DTSTAMP:${utcStamp(sessionStart(0, now))}`,
        `DTSTART:${utcStamp(s.start)}`,
        `DTEND:${utcStamp(s.end)}`,
        `SUMMARY:${icsText(it.title)}`,
        `DESCRIPTION:${icsText(sessionDescription(it))}`,
        "END:VEVENT",
      ]
        .map(foldLine)
        .join("\r\n"),
    ),
  );
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Townsworth//EN", ...events, "END:VCALENDAR"].join("\r\n") + "\r\n";
}
