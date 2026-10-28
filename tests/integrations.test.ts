import assert from "node:assert/strict";
import { test } from "node:test";
import { programIcs } from "../src/app/api/export/ics";
import {
  BODY_CAP,
  HUBSPOT_COMPANY_HEADER,
  SALESFORCE_ACCOUNT_HEADER,
  TRUNCATION_NOTE,
  capBody,
  gmailComposeUrl,
  googleCalendarUrl,
  hubspotCsv,
  itemSessions,
  outlookCalendarUrl,
  outlookComposeUrl,
  salesforceCsv,
  sessionEvent,
  splitAddress,
  utcStamp,
} from "../src/lib/integrations";
import { buildProgram, type ProgramItem } from "../src/lib/plan";
import { NORMAL_PLACES, profileOf } from "./fixtures";

const NOW = new Date(Date.UTC(2026, 9, 28, 14, 30));
const TOWN = { name: "Mount Pleasant", region: "Wisconsin", country: "United States" as const };
const TRICKY = "Fish & chips #1? 100% 🎉\nline two\r\nline three";

const params = (url: string) => new URL(url).searchParams;

function item(over: Partial<ProgramItem> = {}): ProgramItem {
  return {
    id: "training-0",
    bucket: "training",
    title: "Trades night, hosted at Lakeside",
    detail: "",
    partner: { name: "Lakeside Community Center", address: "900 Wood Rd Kenosha, WI 53144", phone: "+1 262-555-0100", website: "https://www.lakeside.example/events", distanceKm: 2.1 },
    role: "host",
    amount: 18000,
    sessions: 2,
    unitCost: 9000,
    unit: "session",
    costBasis: "",
    months: [2, 14],
    cadence: "Once a year",
    provenance: [{ signal: "Qloo place · #4 by local affinity", detail: "#4 of 50 Qloo places within 15 km" }],
    ...over,
  };
}

const header = (csv: string) => csv.split("\n")[0].split(",").map((c) => JSON.parse(c));
const rows = (csv: string) => csv.split(/\n(?=")/).slice(1);

test("URL builders encode & # ? %, emoji and newlines, and decode back to the input", () => {
  const event = { title: TRICKY, details: TRICKY, location: "1 Main St & 2nd, #4", start: new Date(0), end: new Date(3_600_000) };
  for (const url of [googleCalendarUrl(event), outlookCalendarUrl(event), gmailComposeUrl({ subject: TRICKY, body: TRICKY }), outlookComposeUrl({ subject: TRICKY, body: TRICKY })]) {
    const query = url.slice(url.indexOf("?") + 1);
    assert.doesNotMatch(query, /[#? \n\r]|🎉/u, url);
    // Only unreserved characters or %XX escapes, so a raw & or % in the input cannot split or corrupt a parameter.
    for (const pair of query.split("&")) assert.match(pair, /^[a-z]+=(?:[A-Za-z0-9\-_.!~*'()]|%[0-9A-F]{2})*$/, pair);
  }
  const g = params(gmailComposeUrl({ subject: TRICKY, body: TRICKY }));
  assert.equal(g.get("su"), "Fish & chips #1? 100% 🎉 line two line three");
  assert.equal(g.get("body"), TRICKY.replace(/\r\n/g, "\n"));
  assert.equal(g.has("to"), false, "no recipient is invented");
  const o = params(outlookComposeUrl({ to: "a+b@example.org", subject: TRICKY, body: TRICKY }));
  assert.equal(o.get("to"), "a+b@example.org");
  assert.equal(o.get("subject"), "Fish & chips #1? 100% 🎉 line two line three");
  const c = params(googleCalendarUrl(event));
  assert.equal(c.get("text"), "Fish & chips #1? 100% 🎉 line two line three");
  assert.equal(c.get("location"), "1 Main St & 2nd, #4");
  assert.equal(c.get("details"), TRICKY.replace(/\r\n/g, "\n"));
});

test("subjects lose CR and LF", () => {
  for (const url of [gmailComposeUrl({ subject: "a\r\nBcc: x@y.z", body: "" }), outlookComposeUrl({ subject: "a\nb\rc", body: "" })]) {
    const p = params(url);
    assert.doesNotMatch(p.get("su") ?? p.get("subject")!, /[\r\n]/);
  }
});

test("Google dates are UTC in YYYYMMDDTHHMMSSZ form and Outlook dates are ISO", () => {
  const start = new Date("2026-12-15T17:00:00Z");
  const end = new Date("2026-12-15T19:00:00Z");
  const e = { title: "t", details: "d", location: "l", start, end };
  const g = new URL(googleCalendarUrl(e));
  assert.equal(g.origin + g.pathname, "https://calendar.google.com/calendar/render");
  assert.equal(g.searchParams.get("action"), "TEMPLATE");
  assert.equal(g.searchParams.get("dates"), "20261215T170000Z/20261215T190000Z");
  assert.match(g.searchParams.get("dates")!, /^\d{8}T\d{6}Z\/\d{8}T\d{6}Z$/);
  const o = params(outlookCalendarUrl(e));
  assert.equal(o.get("startdt"), "2026-12-15T17:00:00Z");
  assert.equal(o.get("enddt"), "2026-12-15T19:00:00Z");
});

test("long bodies are cut on a sentence boundary, stay under the cap and point to the .eml", () => {
  const body = Array.from({ length: 80 }, (_, i) => `Sentence number ${i} talks about the trades night.`).join(" ");
  assert.ok(body.length > BODY_CAP);
  const capped = capBody(body);
  assert.ok(capped.length <= BODY_CAP, String(capped.length));
  assert.ok(capped.endsWith(`.\n\n${TRUNCATION_NOTE}`), capped.slice(-80));
  assert.ok(body.startsWith(capped.slice(0, -TRUNCATION_NOTE.length - 2)));
  assert.equal(capBody("Short. Body."), "Short. Body.");
  const emoji = capBody("🎉".repeat(2000));
  assert.ok(emoji.length <= BODY_CAP);
  assert.doesNotThrow(() => encodeURIComponent(emoji), "no lone surrogate");
  const decoded = params(gmailComposeUrl({ subject: "s", body })).get("body")!;
  assert.ok(decoded.length <= BODY_CAP && decoded.endsWith(TRUNCATION_NOTE));
});

test("calendar link dates match the .ics DTSTART for every session of a fixture program", () => {
  const program = buildProgram(profileOf(NORMAL_PLACES, { artists: ["Polka Band"] }), 2_000_000);
  const ics = programIcs("mount-pleasant-wi", program.items, NOW);
  const dtstart = new Map([...ics.matchAll(/UID:mount-pleasant-wi-(.+?)@good-neighbor\r\nDTSTAMP:\d{8}T\d{6}Z\r\nDTSTART:(\d{8}T\d{6}Z)/g)].map((m) => [m[1], m[2]]));
  let checked = 0;
  for (const it of program.items)
    for (const s of itemSessions(it, NOW)) {
      const e = sessionEvent(it, s, TOWN);
      const icsStart = dtstart.get(`${it.id}-${s.index}`);
      assert.ok(icsStart, `${it.id}-${s.index}`);
      assert.equal(params(googleCalendarUrl(e)).get("dates")!.split("/")[0], icsStart);
      assert.equal(utcStamp(new Date(params(outlookCalendarUrl(e)).get("startdt")!)), icsStart);
      checked++;
    }
  assert.equal(checked, dtstart.size);
  assert.ok(checked >= 4);
  // Month 2 after October 2026 is December 2026, 17:00 UTC on the 15th.
  assert.equal(itemSessions(item(), NOW)[0].start.toISOString(), "2026-12-15T17:00:00.000Z");
  assert.equal(params(googleCalendarUrl(sessionEvent(item(), itemSessions(item(), NOW)[0], TOWN))).get("location"), "Lakeside Community Center, 900 Wood Rd Kenosha, WI 53144");
});

test("the HubSpot and Salesforce headers equal the documented import names", () => {
  assert.deepEqual(header(hubspotCsv([item()], TOWN)), [
    "Company name", "Company domain name", "Website URL", "Phone number", "Street address", "City", "State/Region", "Postal code", "Country/Region", "Description",
  ]);
  assert.deepEqual(header(salesforceCsv([item()], TOWN)), [
    "Account Name", "Website", "Account Phone", "Billing Street 1", "Billing City", "Billing State", "Billing Postal Code", "Billing Country", "Account Description",
  ]);
  assert.deepEqual(header(hubspotCsv([], TOWN)), [...HUBSPOT_COMPANY_HEADER]);
  assert.deepEqual(header(salesforceCsv([], TOWN)), [...SALESFORCE_ACCOUNT_HEADER]);
});

test("CRM rows carry the split address, domain, role, bucket, distance and Qloo provenance", () => {
  const hs = rows(hubspotCsv([item(), item({ id: "training-1", title: "Second night" }), item({ partner: undefined, role: undefined })], TOWN));
  assert.equal(hs.length, 1, "one company per partner, items without a partner skipped");
  const row = hs[0];
  assert.ok(row.startsWith(`"Lakeside Community Center","lakeside.example","https://www.lakeside.example/events","1-262-555-0100","900 Wood Rd","Kenosha","WI","53144","United States",`), row);
  for (const s of ["Host venue: Trades night", "Host venue: Second night", "Bucket: Trades & training nights", "2.1 km from the site", "Qloo signal: Qloo place · #4 by local affinity"]) assert.ok(row.includes(s), s);
  assert.deepEqual(splitAddress("832 Queen St Kincardine, ON N2Z 2Y2 Canada"), { street: "832 Queen St", city: "Kincardine", state: "ON", postal: "N2Z 2Y2" });
  assert.deepEqual(splitAddress("11600 Washington Ave Mt Pleasant, WI 53177"), { street: "11600 Washington Ave", city: "Mt Pleasant", state: "WI", postal: "53177" });
  assert.deepEqual(splitAddress("3451 NY-31 Baldwinsville, NY 13027"), { street: "3451 NY-31", city: "Baldwinsville", state: "NY", postal: "13027" });
  assert.deepEqual(splitAddress("Somewhere by the lake"), { street: "Somewhere by the lake", city: "", state: "", postal: "" });
});

test("CRM cells that a spreadsheet would run as a formula get a leading quote", () => {
  const evil = item({ title: "=1+1", partner: { name: '=HYPERLINK("http://x","y")', phone: "@cmd", website: "-2+3", address: "+1 Main" } });
  for (const csv of [hubspotCsv([evil], TOWN), salesforceCsv([evil], TOWN)]) {
    const row = rows(csv)[0];
    assert.ok(row.startsWith(`"'=HYPERLINK(""http://x"",""y"")",`), row);
    assert.ok(!row.includes("@cmd") && row.includes(`"'-2+3"`) && row.includes(`"'+1 Main"`), row);
    assert.doesNotMatch(row, /(^|,)"[=+\-@]/);
  }
});

test("CRM phones import without a guard character", async () => {
  const { crmPhone } = await import("../src/lib/integrations");
  assert.equal(crmPhone("+12625952345"), "1-262-595-2345");
  assert.equal(crmPhone("(262) 595-2345"), "262-595-2345");
  assert.equal(crmPhone(undefined), "");
});
