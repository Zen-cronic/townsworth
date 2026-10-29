// Hand-written fixtures only; nothing here is Qloo API output.
import assert from "node:assert/strict";
import { test } from "node:test";
import { addressCity, auditPlan, hostCommunityNames, hostMentions, isKept } from "../src/lib/audit";
import { agentOutputSchema, localTasteNames } from "../src/lib/agent";
import { isMegabrand } from "../src/lib/filters";
import { hubspotCsv } from "../src/lib/integrations";
import { buildProgram, OPEN_GRANT_ID, ROLE_LABEL } from "../src/lib/plan";
import { addTheme, isDistinct } from "../src/lib/profile";
import { SAMPLE_PLAN, splitPlanLines } from "../src/lib/userPlanParse";
import { entity, NORMAL_PLACES, profileOf } from "./fixtures";

// Mount Pleasant fixture town, plus a neighbouring place whose address names Racine.
const PLACES = [
  ...NORMAL_PLACES,
  entity("p7", "Harbor Hall", { cats: ["Banquet hall"], distanceM: 7000, address: "441 Main St Racine, WI 53403", city: "Racine" }),
  entity("p8", "Orchard Market", { cats: ["Orchard", "Event venue", "Bakery"], distanceM: 4000 }),
];
const profile = profileOf(PLACES, { vocab: { Polka: ["Polka Band"] } });
const program = buildProgram(profile, 1_000_000);
const audit = (text: string, named?: string | null, osm?: { found: boolean } | null) => auditPlan([{ text, named, osm }], profile, program.items)[0];

// 1. Host community

test("addresses yield their municipality, not the street", () => {
  assert.equal(addressCity("441 Main St Racine, WI 53403"), "Racine");
  assert.equal(addressCity("5350 Bill Pickett Trail Taylor, TX 76574"), "Taylor");
  assert.equal(addressCity("11600 Washington Ave Mt Pleasant, WI 53177"), "Mt Pleasant");
  assert.equal(addressCity(undefined), undefined);
});

test("host-community names come from the town and the places' cities and addresses", () => {
  const names = hostCommunityNames(profile);
  assert.ok(names.includes("Mount Pleasant"));
  assert.ok(names.includes("Racine"));
  assert.deepEqual(hostMentions("Certified vendors in Taylor and Williamson County", ["Taylor"]), ["Taylor", "Williamson County"]);
  assert.deepEqual(hostMentions("Spend with Racine County firms", ["Racine"]), ["Racine County"]);
  assert.deepEqual(hostMentions("A Milwaukee County fair", ["Racine"]), []);
});

test("a line naming the host community is kept, not 'could fit any town'", () => {
  const row = audit("Free summer movie nights for local residents of Mount Pleasant and Racine County");
  assert.equal(row.verdict, "grounded");
  assert.ok(isKept(row.verdict));
  assert.equal(row.keptAs, "host");
  assert.equal(row.reasons[0], "Names the host community (Mount Pleasant, Racine County)");
  assert.equal(row.replacement, undefined);
});

test("naming the town alone is generic: the line would fit any town with the name swapped", () => {
  for (const text of ["Host a fall festival in Mount Pleasant", "Launch a Mount Pleasant workforce pipeline with internships"]) {
    const row = audit(text);
    assert.equal(row.verdict, "generic", text);
    assert.equal(isKept(row.verdict), false, text);
    assert.match(row.reasons[0], /would fit any town with the name swapped/, text);
    if (row.replacement) assert.equal(row.replacement.bucket, row.bucket, text);
  }
});

test("the town plus a mechanism, an instrument or a local place is kept", () => {
  const mech = audit("Set a local-hire target for Mount Pleasant residents in operations roles");
  assert.equal(mech.verdict, "mechanism");
  const instrument = audit("Quarterly job fair at the Racine County Expo Center");
  assert.equal(instrument.verdict, "grounded");
  assert.equal(instrument.keptAs, "host");
  const place = audit("Summer concert at Harbor Hall in Mount Pleasant");
  assert.equal(place.keptAs, "host");
  const residency = audit("Paid internships reserved for residents of Racine County");
  assert.equal(residency.keptAs, "host");
});

test("a host-community line that is also a purchasing commitment leads with the host reason", () => {
  const row = audit("Help small businesses in Mount Pleasant and Racine County become certified vendors for janitorial and trucking work");
  assert.equal(row.verdict, "mechanism");
  assert.equal(row.reasons[0], "Names the host community (Mount Pleasant, Racine County)");
});

// 2a. Mechanisms stay as mechanisms

test("procurement, local-hire, apprenticeship and engagement lines are kept as mechanisms", () => {
  const cases: [string, string, string][] = [
    ["Set a 20% local purchasing target and publish a spend scorecard", "procurement", "local purchasing commitment"],
    ["Buy local: source 15% of catering from area vendors", "procurement", "local purchasing commitment"],
    ["Local-hire target of 30% for operations roles", "training", "local-hire commitment"],
    ["Paid pre-apprenticeship slots feeding a union apprenticeship pipeline", "training", "apprenticeship pipeline"],
    ["Quarterly open house and listening session with bilingual materials and a published follow-up log", "channels", "community engagement"],
  ];
  for (const [text, bucket, label] of cases) {
    const row = audit(text);
    assert.equal(row.verdict, "mechanism", text);
    assert.equal(row.keptAs, "mechanism", text);
    assert.equal(row.bucket, bucket, text);
    assert.equal(row.keptLabel, label, text);
    assert.equal(row.replacement, undefined, text);
  }
});

test("a purchasing mechanism gets the program's supplier day added alongside, never swapped", () => {
  const row = audit("Set a 20% local purchasing target with certified vendors");
  assert.equal(row.alongside?.bucket, "procurement");
  assert.equal(row.alongside?.role, "host");
  assert.equal(row.replacement, undefined);
});

test("a one-off open house at the facility is not an engagement mechanism", () => {
  assert.equal(audit('"Data Center 101" open house at the facility').verdict, "generic");
});

// 2b. In-kind help

test("employee volunteering is kept in-kind, in events, and never replaced by a costed grant", () => {
  const row = audit("Create a volunteer program that gives employees paid hours to support food pantries and school supply drives");
  assert.equal(row.verdict, "mechanism");
  assert.equal(row.keptAs, "in-kind");
  assert.equal(row.keptLabel, "in-kind (not costed)");
  assert.equal(row.bucket, "events");
  assert.equal(row.replacement, undefined);
  assert.equal(row.alongside, undefined);
});

test("mentoring is in-kind and sits in training", () => {
  const row = audit("Engineers mentor students through job-shadow days");
  assert.equal(row.keptAs, "in-kind");
  assert.equal(row.bucket, "training");
});

// 2c. A named partner the line never mentions

test("a named partner absent from the line is reported as such; the verdict follows the in-kind rule", () => {
  const row = audit("Create a volunteer program that gives employees paid hours for cleanup days", "Joy House", { found: false });
  assert.equal(row.reasons[0], 'The draft names "Joy House" as partner, not found locally');
  assert.equal(row.keptAs, "in-kind");
  assert.ok(isKept(row.verdict));
});

test("a named partner absent from a generic line stays unverified and is struck", () => {
  const row = audit("Sponsor a 5K fun run", "Joy House", { found: false });
  assert.equal(row.verdict, "unverified");
  assert.equal(row.reasons[0], 'The draft names "Joy House" as partner, not found locally');
});

// 2d. Generic lines

test("only genuinely generic lines are struck, and swapped like for like", () => {
  for (const text of ["Sponsor a 5K fun run", "Small-business breakfast with the chamber of commerce", "Donate to the regional food bank"]) {
    const row = audit(text);
    assert.equal(row.verdict, "generic", text);
    if (row.replacement) assert.equal(row.replacement.bucket, row.bucket, text);
    assert.notEqual(row.replacement?.id, OPEN_GRANT_ID, text);
  }
});

test("the /check sample plan: spend share kept, volunteer day in-kind, grant panel a mechanism", () => {
  const lines = splitPlanLines(SAMPLE_PLAN).items;
  const rows = auditPlan(lines.map((text) => ({ text })), profile, program.items);
  const find = (needle: string) => rows.find((r) => r.text.includes(needle))!;
  const spend = find("15%");
  assert.equal(spend.verdict, "mechanism");
  assert.equal(spend.keptAs, "mechanism");
  const volunteer = find("volunteer day");
  assert.equal(volunteer.keptAs, "in-kind");
  assert.equal(volunteer.replacement, undefined);
  const grants = find("advisory panel");
  assert.equal(grants.verdict, "mechanism");
  assert.equal(grants.keptLabel, "grant mechanism");
  assert.ok((grants.applicants ?? []).every((a) => a.bucket === "grants" && a.partner));
});

// 3. Supplier days

test("supplier days are hosted at a hall-type venue, never a bakery or orchard cast as a supplier", () => {
  const days = program.items.filter((i) => i.bucket === "procurement");
  assert.ok(days.length > 0);
  for (const d of days) {
    assert.equal(d.role, "host");
    assert.match(d.title, /^Supplier day hosted at /);
    assert.match(d.detail, /vendors invited from the county's certified and local business lists/i);
    assert.ok(!["Kringle Corner Bakery", "Orchard Market", "Harbor Brewing"].includes(d.partner!.name), d.partner!.name);
  }
  assert.ok(!Object.values(ROLE_LABEL).includes("Invited supplier"));
  const csv = hubspotCsv(days, { country: "United States" });
  assert.match(csv, /Host venue: Supplier day hosted at/);
  assert.doesNotMatch(csv, /Invited supplier/);
});

// C/D. Grants: host municipality first, open cycle itemized

test("grantees come from the host municipality first; neighbours only top up to two", () => {
  const places = [
    entity("g1", "Town Museum", { cats: ["Museum"], distanceM: 2000 }),
    entity("g2", "Far Zoo", { cats: ["Zoo"], distanceM: 13000 }),
    entity("g3", "Next Town Park", { cats: ["Park"], distanceM: 12000 }),
  ];
  const p = profileOf(places);
  p.placeMeta.set("g2", { affinityRank: 1, host: false, inTown: false, city: "Kenosha" });
  p.placeMeta.set("g3", { affinityRank: 2, host: false, inTown: false, city: "Kenosha" });
  p.placeMeta.set("g1", { affinityRank: 3, host: true, inTown: true, city: "Mount Pleasant" });
  const grants = buildProgram(p, 1_000_000).items.filter((i) => i.bucket === "grants" && i.partner);
  assert.deepEqual(grants.map((g) => g.partner!.name), ["Town Museum", "Far Zoo"]);
  assert.equal(grants[1].partner!.neighbouring, true);
});

test("the unused grants share is an itemized open cycle and the fund still reconciles", () => {
  const p = buildProgram(profileOf([]), 500_000);
  const open = p.items.find((i) => i.id === OPEN_GRANT_ID);
  assert.ok(open);
  assert.equal(open.partner, undefined);
  assert.equal(open.amount, 0.3 * 2 * 500_000);
  assert.equal(open.cadence, "Once a year (months 9 and 21)");
  assert.equal(p.totalAllocated + p.unassigned, 2 * 500_000);
});

// 4. No megabrands as local signals

test("national platforms, megabrands and national top-50 brands are never local signals", () => {
  for (const n of ["Instagram", "Starbucks", "McDonald’s", "TikTok", "Netflix", "Walmart", "Target"]) assert.ok(isMegabrand(n), n);
  assert.ok(!isMegabrand("Green Bay Packers"));
  const national = new Set(["green bay packers"]);
  assert.ok(isMegabrand("Green Bay Packers", national));
  assert.equal(isDistinct("Instagram", null, 0, new Set()), false);
  assert.equal(isDistinct("Milwaukee Admirals", null, 0, new Set()), true);
  const vocab = new Map<string, string[]>();
  addTheme(vocab, "Starbucks", "Starbucks", false, new Set());
  addTheme(vocab, "Green Bay Packers", "Green Bay Packers", false, national);
  addTheme(vocab, "Milwaukee Admirals", "Milwaukee Admirals", false, national);
  assert.deepEqual([...vocab.keys()], ["Milwaukee Admirals"]);
});

test("the agent's local_taste never offers a megabrand", () => {
  const sig = (name: string, distinct = true) => ({ distinct, entity: { name } });
  assert.deepEqual(localTasteNames([sig("Instagram"), sig("Milwaukee Admirals"), sig("Starbucks"), sig("Local Polka Hour", false)]), ["Milwaukee Admirals"]);
});

test("a draft may omit the local signal", () => {
  const draft = { itemId: "training-0", partner: "Lakeside Community Center", reason: "Fits", localSignal: null, subject: "Hi", body: "Hello" };
  const parsed = agentOutputSchema.parse({ summary: "s", drafts: [draft], dropped: [] });
  assert.equal(parsed.drafts[0].localSignal, null);
});
