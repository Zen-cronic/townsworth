import assert from "node:assert/strict";
import { test } from "node:test";
import { fundSplit, lineComposition, partnerPoints, sessionsByBucket, splitFigures, stackDots } from "../src/components/charts/chartData";
import { buildProgram, type ProgramItem } from "../src/lib/plan";
import { NORMAL_PLACES, profileOf } from "./fixtures";

const program = buildProgram(profileOf(NORMAL_PLACES), 250_000);

test("line composition counts each verdict once, in draft order", () => {
  const c = lineComposition([{ verdict: "grounded" }, { verdict: "generic" }, { verdict: "institution" }, { verdict: "unverified" }, { verdict: "mechanism" }]);
  assert.deepEqual(c.lines, ["kept", "generic", "kept", "unverified", "kept"]);
  assert.equal(c.kept + c.generic + c.unverified, c.total);
  assert.deepEqual([c.kept, c.generic, c.unverified], [3, 1, 1]);
});

test("the fund split sums to the itemized program plus the reserve", () => {
  const { total, parts } = fundSplit(program.items, program.unassigned);
  assert.equal(total, program.totalAllocated + program.unassigned);
  assert.equal(
    parts.reduce((s, p) => s + p.amount, 0),
    total,
  );
  assert.equal(parts.at(-1)?.key, "reserve");
  assert.ok(parts.every((p) => p.amount > 0));
  assert.equal(
    parts.filter((p) => p.key !== "reserve").reduce((s, p) => s + p.items, 0),
    program.items.filter((i) => i.amount > 0).length,
  );
});

test("the fund split drops empty areas and has no reserve segment when nothing is held back", () => {
  const items = [{ bucket: "training", amount: 100 }, { bucket: "grants", amount: 300 }] as Pick<ProgramItem, "bucket" | "amount">[];
  const { total, parts } = fundSplit(items, 0);
  assert.equal(total, 400);
  assert.deepEqual(
    parts.map((p) => [p.key, p.pct]),
    [
      ["training", 25],
      ["grants", 75],
    ],
  );
});

test("partner points list each partner once, ranked by affinity, unranked last", () => {
  const items = [
    { partner: { name: "B Hall", distanceKm: 3 } },
    { partner: { name: "A Park", distanceKm: 9, affinityRank: 4 } },
    { partner: { name: "C Zoo", distanceKm: 1, affinityRank: 1 } },
    { partner: { name: "a park", distanceKm: 9, affinityRank: 4 } },
    {},
  ] as Pick<ProgramItem, "partner">[];
  const pts = partnerPoints(items);
  assert.deepEqual(
    pts.map((p) => [p.name, p.items]),
    [
      ["C Zoo", 1],
      ["A Park", 2],
      ["B Hall", 1],
    ],
  );
});

test("sessions by area match each item's scheduled months", () => {
  const rows = sessionsByBucket(program.items);
  const scheduled = program.items.reduce((s, i) => s + i.months.length, 0);
  assert.equal(
    rows.reduce((s, r) => s + r.sessions, 0),
    scheduled,
  );
  for (const r of rows) for (const m of r.months.keys()) assert.ok(m >= 1 && m <= 24);
});

test("figures in a commitment are split out; dates and small counts are not", () => {
  const amounts = (t: string) => splitFigures(t).filter((_, i) => i % 2 === 1);
  assert.deepEqual(amounts("about 2,000 jobs and $1.4 billion by Jan. 1, 2028"), ["2,000", "$1.4 billion"]);
  assert.deepEqual(amounts("up to 702,000 gallons a day (about 8.4 million gallons a year)"), ["702,000", "8.4 million"]);
  assert.deepEqual(amounts("a 250 MW solar project, 100% of the costs, a 15-year term in 2026"), ["250 MW", "100%"]);
  assert.equal(splitFigures("no numbers here").join(""), "no numbers here");
});

test("dots closer than the gap stack into separate lanes", () => {
  assert.deepEqual(stackDots([0.1, 0.11, 0.5, 0.12, 0.9], 0.06), [0, 1, 0, 2, 0]);
  assert.deepEqual(stackDots([0.1, 0.2, 0.3], 0.06), [0, 0, 0]);
});
