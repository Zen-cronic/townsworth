// No-login integrations: calendar and mail compose deep links, and CRM import CSVs.
// Everything here is a pure function of its inputs. Nothing calls a provider API.

import { guardFormula } from "./ballot";
import { BUCKETS, ROLE_LABEL, type Partner, type ProgramItem } from "./plan";
import type { Town } from "./towns";

// Session dates, shared with the .ics export

// Each session starts at 17:00 UTC on the 15th. Month 1 of the program is the first month after `now`.
export function sessionStart(month: number, now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + month, 15, 17));
}

// Length used for the calendar links. The .ics export carries DTSTART only.
export const SESSION_HOURS = 2;

// RFC 5545 UTC DATE-TIME (YYYYMMDDTHHMMSSZ), also the format Google Calendar's `dates` expects.
export const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";

export interface Session {
  // Position of the session within the item, used in the .ics UID.
  index: number;
  month: number;
  start: Date;
  end: Date;
}

export function itemSessions(item: Pick<ProgramItem, "months">, now: Date = new Date()): Session[] {
  return item.months.map((month, index) => {
    const start = sessionStart(month, now);
    return { index, month, start, end: new Date(start.getTime() + SESSION_HOURS * 3_600_000) };
  });
}

export const sessionDescription = (item: Pick<ProgramItem, "bucket">) =>
  `${BUCKETS[item.bucket].label}. Draft date: confirm with the partner. Sponsor-labelled program item.`;

// The host venue when the item has one, otherwise the town.
export function sessionLocation(item: Pick<ProgramItem, "partner" | "role">, town: Pick<Town, "name" | "region">): string {
  if (item.partner && item.role === "host") return [item.partner.name, item.partner.address].filter(Boolean).join(", ");
  return `${town.name}, ${town.region}`;
}

// URL builders

const enc = encodeURIComponent;
const query = (params: [string, string | undefined][]) =>
  params
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${enc(v!)}`)
    .join("&");

export const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();

export const BODY_CAP = 1800;
export const TRUNCATION_NOTE = "(Full draft in the .eml download.)";

// Caps the body at `cap` characters, cutting at the last sentence end that fits and appending TRUNCATION_NOTE.
export function capBody(body: string, cap: number = BODY_CAP): string {
  const text = body.replace(/\r\n?/g, "\n");
  if (text.length <= cap) return text;
  const tail = `\n\n${TRUNCATION_NOTE}`;
  const room = cap - tail.length;
  const head = text.slice(0, room);
  let cut = -1;
  for (const m of head.matchAll(/[.!?]["')\]]*(?=\s|$)/g)) cut = m.index + m[0].length;
  if (cut < room / 2) {
    const space = head.search(/\s\S*$/);
    cut = space > room / 2 ? space : room;
  }
  // Never split a surrogate pair.
  const code = text.charCodeAt(cut - 1);
  if (code >= 0xd800 && code <= 0xdbff) cut -= 1;
  return text.slice(0, cut).trimEnd() + tail;
}

export interface CalendarEvent {
  title: string;
  details: string;
  location: string;
  start: Date;
  end: Date;
}

export function googleCalendarUrl(e: CalendarEvent): string {
  return `https://calendar.google.com/calendar/render?${query([
    ["action", "TEMPLATE"],
    ["text", oneLine(e.title)],
    ["dates", `${utcStamp(e.start)}/${utcStamp(e.end)}`],
    ["details", capBody(e.details)],
    ["location", oneLine(e.location)],
  ])}`;
}

const isoSeconds = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

export function outlookCalendarUrl(e: CalendarEvent): string {
  return `https://outlook.office.com/calendar/0/deeplink/compose?${query([
    ["subject", oneLine(e.title)],
    ["startdt", isoSeconds(e.start)],
    ["enddt", isoSeconds(e.end)],
    ["body", capBody(e.details)],
    ["location", oneLine(e.location)],
  ])}`;
}

export interface ComposeMessage {
  to?: string;
  subject: string;
  body: string;
}

export function gmailComposeUrl(m: ComposeMessage): string {
  return `https://mail.google.com/mail/?${query([
    ["view", "cm"],
    ["fs", "1"],
    ["to", m.to?.trim()],
    ["su", oneLine(m.subject)],
    ["body", capBody(m.body)],
  ])}`;
}

export function outlookComposeUrl(m: ComposeMessage): string {
  return `https://outlook.office.com/mail/deeplink/compose?${query([
    ["to", m.to?.trim()],
    ["subject", oneLine(m.subject)],
    ["body", capBody(m.body)],
  ])}`;
}

export function sessionEvent(item: ProgramItem, session: Session, town: Pick<Town, "name" | "region">): CalendarEvent {
  return { title: item.title, details: sessionDescription(item), location: sessionLocation(item, town), start: session.start, end: session.end };
}

// CRM import CSVs

// HubSpot company property labels:
// https://knowledge.hubspot.com/properties/hubspot-crm-default-company-properties
// https://knowledge.hubspot.com/import-and-export/set-up-your-import-file
export const HUBSPOT_COMPANY_HEADER = [
  "Company name",
  "Company domain name",
  "Website URL",
  "Phone number",
  "Street address",
  "City",
  "State/Region",
  "Postal code",
  "Country/Region",
  "Description",
] as const;

// Salesforce "Label for Your Import File" values for account fields:
// https://help.salesforce.com/s/articleView?id=xcloud.field_mapping_for_other_data_sources_and_organization_import.htm&type=5
export const SALESFORCE_ACCOUNT_HEADER = [
  "Account Name",
  "Website",
  "Account Phone",
  "Billing Street 1",
  "Billing City",
  "Billing State",
  "Billing Postal Code",
  "Billing Country",
  "Account Description",
] as const;

export const csvCell = (v: unknown) => {
  const s = typeof v === "string" ? guardFormula(v) : String(v ?? "");
  return `"${s.replace(/"/g, '""')}"`;
};

export const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(csvCell).join(",")).join("\n");

export interface PostalAddress {
  street: string;
  city: string;
  state: string;
  postal: string;
}

const STREET_SUFFIX =
  /^(rd|road|ave|avenue|st|street|dr|drive|blvd|boulevard|ln|lane|way|ct|court|hwy|highway|pkwy|parkway|pl|place|cir|circle|ter|terrace|trl|trail|sq|square|pike|rte|route|cres|crescent|line|sideroad)\.?$/i;
const DIRECTION = /^(n|s|e|w|ne|nw|se|sw)\.?$/i;
const ROUTE = /^[A-Z]{1,3}-\d+[A-Z]?$/i;
// A street suffix, a route ("NY-31"), or a direction or number that follows a suffix ("Main St N", "Hwy 21").
const endsStreet = (words: string[], i: number) =>
  STREET_SUFFIX.test(words[i]) || ROUTE.test(words[i]) || ((DIRECTION.test(words[i]) || /^\d+[A-Z]?$/i.test(words[i])) && i > 0 && STREET_SUFFIX.test(words[i - 1]));
const CITY_WORD = /^[A-Za-zÀ-ÿ.'-]+$/;

// Splits "900 Wood Rd Kenosha, WI 53144" style addresses. Anything it cannot split stays whole in `street`.
export function splitAddress(address: string | undefined, city?: string): PostalAddress {
  const out: PostalAddress = { street: (address ?? "").trim(), city: "", state: "", postal: "" };
  const m = out.street.match(/^(.+?),\s*([A-Z]{2})\s+([A-Z]\d[A-Z] ?\d[A-Z]\d|\d{5}(?:-\d{4})?)(?:,?\s+(?:USA|US|United States|Canada))?$/i);
  if (!m) return out;
  const [, pre, state, postal] = m;
  out.state = state.toUpperCase();
  out.postal = postal.toUpperCase();
  out.street = pre.trim();
  if (city && pre.toLowerCase().endsWith(` ${city.toLowerCase()}`)) {
    out.street = pre.slice(0, -city.length - 1).trim();
    out.city = pre.slice(-city.length);
    return out;
  }
  const words = pre.trim().split(/\s+/);
  for (let i = words.length - 1; i >= 2; i--) {
    if (!CITY_WORD.test(words[i])) break;
    if (endsStreet(words, i - 1)) {
      out.street = words.slice(0, i).join(" ");
      out.city = words.slice(i).join(" ");
      break;
    }
  }
  return out;
}

export function domainOf(website: string | undefined): string {
  if (!website) return "";
  try {
    return new URL(website).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export interface CrmAccount {
  partner: Partner;
  notes: string[];
}

// One account per partner, in program order, with a note line for each item it appears in.
export function crmAccounts(items: ProgramItem[]): CrmAccount[] {
  const byName = new Map<string, CrmAccount>();
  for (const it of items) {
    if (!it.partner?.name) continue;
    const key = it.partner.name.trim().toLowerCase();
    const acct = byName.get(key) ?? { partner: it.partner, notes: [] };
    const p = it.partner;
    const where = [p.distanceKm != null ? `${p.distanceKm} km from the site` : "", p.neighbouring ? "neighbouring community" : ""].filter(Boolean).join(", ");
    const signal = it.provenance[0];
    acct.notes.push(
      [
        `${it.role ? ROLE_LABEL[it.role] : "Partner"}: ${it.title}.`,
        `Bucket: ${BUCKETS[it.bucket].label}.`,
        where && `Distance: ${where}.`,
        it.runWith && !it.title.includes(it.runWith) && `Run with ${it.runWith}.`,
        `Program months: ${it.months.join(", ")}.`,
        signal && `Qloo signal: ${signal.signal}. ${signal.detail}`,
      ]
        .filter(Boolean)
        .join(" "),
    );
    byName.set(key, acct);
  }
  return [...byName.values()];
}

const NOTE_PREFIX = "Good Neighbor draft program, not contacted yet.";
const description = (a: CrmAccount) => [NOTE_PREFIX, ...a.notes].join("\n");

// CRM imports read the phone column literally, so drop the leading "+" (which spreadsheets treat as a formula) instead of guarding it.
export function crmPhone(raw?: string | null): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return `1-${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return digits;
}

export function hubspotCsv(items: ProgramItem[], town: Pick<Town, "country">): string {
  const rows = crmAccounts(items).map((a) => {
    const p = a.partner;
    const addr = splitAddress(p.address, p.city);
    return [p.name, domainOf(p.website), p.website, crmPhone(p.phone), addr.street, addr.city, addr.state, addr.postal, addr.street ? town.country : "", description(a)];
  });
  return toCsv([[...HUBSPOT_COMPANY_HEADER], ...rows]);
}

export function salesforceCsv(items: ProgramItem[], town: Pick<Town, "country">): string {
  const rows = crmAccounts(items).map((a) => {
    const p = a.partner;
    const addr = splitAddress(p.address, p.city);
    return [p.name, p.website, crmPhone(p.phone), addr.street, addr.city, addr.state, addr.postal, addr.street ? town.country : "", description(a)];
  });
  return toCsv([[...SALESFORCE_ACCOUNT_HEADER], ...rows]);
}
