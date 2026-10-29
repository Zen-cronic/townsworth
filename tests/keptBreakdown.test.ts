import assert from "node:assert/strict";
import { test } from "node:test";
import { auditPlan, isKept, type AuditRow } from "../src/lib/audit";
import { buildProgram } from "../src/lib/plan";
import { keptBreakdown } from "../src/components/ui/keptBreakdown";
import { NORMAL_PLACES, profileOf } from "./fixtures";

const profile = profileOf(NORMAL_PLACES, { vocab: { Kringle: ["Kringle Corner Bakery"] } });
const program = buildProgram(profile, 250_000).items;

// One draft line per way a line can be kept, plus struck lines.
const audit = auditPlan(
  [
    { text: "Sponsor a brewery tour", named: "Harbor Brewing" },
    { text: "Small-business workshops with the county EDC", named: "Racine County Economic Development Corporation" },
    { text: "Host a Kringle tasting table at the summer market" },
    { text: "Summer reading challenge for residents of Mount Pleasant run through the village library branch" },
    { text: "Community micro-grants with decisions made by a resident advisory panel" },
    { text: "Employee volunteer days at local schools" },
    { text: "Sponsor a 5K fun run" },
    { text: "Sponsor a concert", named: "Imaginary Hall of Sound" },
  ],
  profile,
  program,
);

test("the fixture audit covers every kept category", () => {
  assert.deepEqual(
    audit.map((r) => r.keptAs ?? r.verdict),
    ["partner", "institution", "signal", "host", "mechanism", "in-kind", "generic", "unverified"],
  );
});

test("kept categories sum to the kept total", () => {
  const b = keptBreakdown(audit);
  const kept = audit.filter((r) => isKept(r.verdict)).length;
  assert.equal(b.total, kept);
  assert.equal(b.total, 6);
  assert.equal(Object.values(b.counts).reduce((s, n) => s + n, 0), kept);
  assert.deepEqual(b.counts, { partner: 1, institution: 1, signal: 1, host: 1, mechanism: 1, "in-kind": 1 });
});

test("the breakdown text names every category and its counts add up", () => {
  const { parts, total } = keptBreakdown(audit);
  assert.deepEqual(parts, [
    "1 verified local partner",
    "1 institution to confirm",
    "1 match to a local favourite",
    "1 line naming the host community",
    "1 commitment kept as drafted",
    "1 in-kind item (not costed)",
  ]);
  assert.equal(parts.reduce((s, p) => s + Number(p.split(" ")[0]), 0), total);
});

test("zero categories are omitted, and a row without keptAs falls back on its verdict", () => {
  const rows = audit.slice(0, 2).map((r): AuditRow => ({ ...r, keptAs: undefined }));
  const b = keptBreakdown([...rows, audit[6]]);
  assert.equal(b.total, 2);
  assert.deepEqual(b.parts, ["1 verified local partner", "1 institution to confirm"]);
});
