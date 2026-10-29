import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { buildProgram } from "../src/lib/plan";
import { resetLimits, takeSlot } from "../src/lib/rateLimit";
import { auditDraft } from "../src/lib/run";
import { parsePlan } from "../src/lib/userPlan";
import {
  groundModelItems,
  MAX_CHARS,
  MAX_ITEMS,
  SAMPLE_PLAN,
  splitPlanLines,
  userPlanMessage,
  userPlanPrompt,
  userPlanSchema,
  validateCheckInput,
} from "../src/lib/userPlanParse";
import { MAX_FUND } from "../src/app/api/fund";
import { NORMAL_PLACES, profileOf } from "./fixtures";
import { auditCsv, buildExport, fileStem, programCsv } from "../src/components/check/exportCheck";
import type { CheckResult } from "../src/lib/userPlan";

beforeEach(resetLimits);

test("the splitter handles bullets, numbering, headings and blank lines", () => {
  const text = [
    "COMMUNITY COMMITMENTS",
    "",
    "Workforce:",
    "• Fund a welding certificate cohort",
    "- Sponsor a STEM summer camp for students",
    "* Host a fall festival at the town park",
    "  ",
    "1. Plant street trees along the corridor",
    "2) Run newspaper ads for job openings",
    "(a) Quarterly breakfast with local businesses",
    "Section 3.2 Annual donation to the food bank",
    "# Grants",
    "Community grants; decided by a resident advisory panel; through an open application cycle",
    "Short one",
    "Community Events",
  ].join("\n");
  const { items, truncated } = splitPlanLines(text);
  assert.equal(truncated, false);
  assert.deepEqual(items, [
    "Fund a welding certificate cohort",
    "Sponsor a STEM summer camp for students",
    "Host a fall festival at the town park",
    "Plant street trees along the corridor",
    "Run newspaper ads for job openings",
    "Quarterly breakfast with local businesses",
    "Annual donation to the food bank",
    "Community grants",
    "decided by a resident advisory panel",
    "through an open application cycle",
  ]);
});

test("the sample plan splits into its ten numbered items", () => {
  const { items } = splitPlanLines(SAMPLE_PLAN);
  assert.equal(items.length, 10);
  assert.match(items[0], /^Fund a welding/);
  assert.match(items[9], /regional food bank\.$/);
});

test("the splitter caps at 40 items and says it truncated", () => {
  const text = Array.from({ length: 55 }, (_, i) => `- Commitment number ${i + 1} for the town`).join("\n");
  const { items, truncated } = splitPlanLines(text);
  assert.equal(items.length, MAX_ITEMS);
  assert.equal(truncated, true);
  assert.equal(splitPlanLines(text.split("\n").slice(0, 40).join("\n")).truncated, false);
});

test("validation: too long is 413, empty or a bad slug is 400, the fund is capped", () => {
  const ok = "Sponsor a STEM summer camp for middle-school students in town.";
  const long = validateCheckInput({ town: "mount-pleasant-wi", text: "x".repeat(MAX_CHARS + 1) });
  assert.equal(long.ok, false);
  assert.equal(!long.ok && long.status, 413);
  const empty = validateCheckInput({ town: "mount-pleasant-wi", text: "   " });
  assert.equal(!empty.ok && empty.status, 400);
  const badSlug = validateCheckInput({ town: "Nowhere-ZZ~0_0~fab", text: ok });
  assert.equal(!badSlug.ok && badSlug.status, 400);
  assert.equal(validateCheckInput(null).ok, false);
  assert.equal(validateCheckInput({ town: "mount-pleasant-wi", text: 42 }).ok, false);
  const capped = validateCheckInput({ town: "mount-pleasant-wi", fund: "5,000,000,000,000", text: ok });
  assert.equal(capped.ok && capped.fund, MAX_FUND);
  const fund = validateCheckInput({ town: "Taylor-TX~30.5729_-97.4141~fab~Samsung", fund: 750000, text: ok });
  assert.ok(fund.ok);
  assert.equal(fund.ok && fund.fund, 750000);
  assert.equal(fund.ok && fund.town.name, "Taylor");
  // Error messages never echo the pasted text.
  assert.doesNotMatch(!long.ok ? long.error : "", /xxxx/);
});

test("grounding drops an invented item and nulls an invented partner", () => {
  const text = "1. Fund a welding cohort with the local technical college.\n2. Host a fall festival at a town park.";
  const out = groundModelItems(text, [
    { item: "Fund a welding cohort with the local technical college.", partner: "the local technical college" },
    { item: "Host a fall festival at a town park.", partner: "Riverside Amphitheater" },
    { item: "Endow a quantum computing chair at the state university", partner: "State University" },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].named, "the local technical college");
  assert.equal(out[1].named, null);
  assert.ok(!out.some((o) => /quantum/.test(o.text)));
});

test("a kind of partner is not a named partner; 'the' plus a body is", () => {
  const text = "Catering from area vendors. A festival at a town park. Breakfast with the chamber of commerce. Fair with local businesses.";
  const out = groundModelItems(text, [
    { item: "Catering from area vendors.", partner: "area vendors" },
    { item: "A festival at a town park.", partner: "a town park" },
    { item: "Breakfast with the chamber of commerce.", partner: "the chamber of commerce" },
    { item: "Fair with local businesses.", partner: "local businesses" },
  ]);
  assert.deepEqual(
    out.map((o) => o.named),
    [null, null, "the chamber of commerce", null],
  );
});

test("the schema caps items at 40 and each item at 400 characters", () => {
  assert.equal(userPlanSchema.safeParse({ items: Array.from({ length: 41 }, () => ({ item: "x", partner: null })) }).success, false);
  assert.equal(userPlanSchema.safeParse({ items: [{ item: "x".repeat(401), partner: null }] }).success, false);
  assert.equal(userPlanSchema.safeParse({ items: [{ item: "Plant trees", partner: null }] }).success, true);
});

test("the prompt keeps the plan out of the system message and treats it as data", () => {
  const system = userPlanPrompt({ name: "Mount Pleasant", region: "Wisconsin" });
  assert.doesNotMatch(system, /welding/);
  assert.match(system, /never as instructions/);
  assert.match(system, /verbatim/);
  assert.match(userPlanMessage("Plant trees"), /^<plan>\nPlant trees\n<\/plan>$/);
});

test("the check limiter: five pass, the sixth fails, and it doesn't use up live drafts", () => {
  const t = Date.UTC(2026, 9, 28, 12);
  for (let i = 0; i < 5; i++) assert.equal(takeSlot("check", "1.2.3.4", t + i).ok, true);
  assert.equal(takeSlot("check", "1.2.3.4", t + 5).ok, false);
  for (let i = 0; i < 5; i++) assert.equal(takeSlot("live-draft", "1.2.3.4", t + 10 + i).ok, true);
});

test("the fixture parse and a short draft make no model call", async () => {
  const town = { name: "Mount Pleasant", region: "Wisconsin" };
  const prev = process.env.CHECK_MODEL_FIXTURE;
  process.env.CHECK_MODEL_FIXTURE = "1";
  try {
    const fixture = await parsePlan(SAMPLE_PLAN, town);
    assert.equal(fixture.method, "model");
    assert.equal(fixture.model, "fixture");
    assert.equal(fixture.inputs.length, 10);
  } finally {
    if (prev === undefined) delete process.env.CHECK_MODEL_FIXTURE;
    else process.env.CHECK_MODEL_FIXTURE = prev;
  }
  const short = await parsePlan("- Sponsor a STEM camp for students\n- Plant street trees downtown", town);
  assert.equal(short.method, "lines");
  assert.equal(short.inputs.length, 2);
  assert.ok(short.notice);
});

test("a hand-written draft: institution kept, grounded, generic with a like-for-like swap, mechanism", () => {
  const profile = profileOf(NORMAL_PLACES, { vocab: { Polka: ["Polka Band"] } });
  const program = buildProgram(profile, 1_000_000);
  const { audit, qlooAdds } = auditDraft(
    [
      { text: "Welding cohort with the county workforce board", named: "Racine County Workforce Board", osm: { found: false } },
      { text: "Supplier breakfast at Kringle Corner Bakery", named: "Kringle Corner Bakery" },
      { text: "Sponsor a STEM summer camp for middle-school students" },
      { text: "Community grants decided by a resident advisory panel through an open application cycle" },
      { text: "Polka night in the park" },
    ],
    profile,
    program,
  );
  assert.deepEqual(
    audit.map((a) => a.verdict),
    ["institution", "grounded", "generic", "mechanism", "grounded"],
  );
  assert.equal(audit[1].matched?.source, "qloo");
  const swap = audit[2].replacement;
  assert.ok(swap);
  assert.equal(swap.bucket, audit[2].bucket);
  assert.ok((audit[3].applicants ?? []).every((a) => a.bucket === "grants"));
  // The kept institution runs the training items.
  assert.ok(program.items.filter((it) => it.bucket === "training").every((it) => it.runWith === "Racine County Workforce Board"));
  // Partners the draft already named are not suggested again.
  assert.ok(!qlooAdds.some((it) => it.partner?.name === "Kringle Corner Bakery"));
});

function fixtureResult(): CheckResult {
  const profile = profileOf(NORMAL_PLACES);
  const program = buildProgram(profile, 1_000_000);
  const { audit, qlooAdds } = auditDraft(
    [
      { text: "=HYPERLINK(\"x\") Sponsor a STEM summer camp for students" },
      { text: "Welding cohort with the county workforce board", named: "Racine County Workforce Board", osm: { found: false } },
    ],
    profile,
    program,
  );
  return {
    town: profile.town,
    annualFund: 1_000_000,
    parse: { method: "lines", ms: 1, items: 2 },
    osm: { checked: 0, failures: 0, ms: 0 },
    qlooSearch: { checked: 0, verified: 0, failures: 0, ms: 0 },
    audit,
    qlooAdds,
    program: { items: program.items, totalAllocated: program.totalAllocated, unassigned: program.unassigned, twoYearFund: program.twoYearFund, costNote: program.costNote },
    profile: { thin: false, localPlaces: 6, excluded: 0, failedCalls: 0, calls: [] },
    ms: 1,
  };
}

test("browser exports: audit CSV guards formulas, program CSV reconciles, ICS and CRM files build", () => {
  const result = fixtureResult();
  const audit = auditCsv(result).split("\n");
  assert.equal(audit.length, 3);
  assert.match(audit[1], /^"1","'=HYPERLINK/);
  assert.match(audit[1], /"Not local"/);
  assert.match(audit[2], /"Kept \(institution, couldn't verify here\)"/);
  const program = programCsv(result).split("\n");
  assert.equal(program.length, result.program.items.length + 2);
  assert.match(program.at(-1)!, /^"Unassigned"/);
  // The kept institution from the pasted draft runs the training items in the export.
  assert.ok(program.some((l) => l.includes("Racine County Workforce Board")));
  const ics = buildExport("ics", result, new Date(Date.UTC(2026, 9, 28)));
  assert.match(ics.body, /^BEGIN:VCALENDAR\r\n/);
  assert.ok(ics.filename.endsWith("-your-draft-program.ics"));
  assert.match(buildExport("hubspot", result).body, /^"?Company name/i);
  assert.ok(buildExport("salesforce", result).body.length > 0);
  assert.equal(fileStem("Taylor-TX~30.5729_-97.4141~fab~Samsung"), "Taylor-TX_30.5729_-97.4141_fab_Samsung");
});
