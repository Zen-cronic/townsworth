import assert from "node:assert/strict";
import { test } from "node:test";
import { auditPlan, isKept } from "../src/lib/audit";
import { buildProgram } from "../src/lib/plan";
import { NORMAL_PLACES, profileOf } from "./fixtures";

const profile = profileOf(NORMAL_PLACES, { vocab: { Target: ["Target"], Polka: ["Polka Band"] } });
const program = buildProgram(profile, 1_000_000).items;

test("an institution that Qloo and OpenStreetMap can't find is kept, not struck", () => {
  const [row] = auditPlan(
    [{ text: "Workforce training with the county economic development corporation", named: "Racine County Economic Development Corporation", osm: { found: false } }],
    profile,
    program,
  );
  assert.equal(row.verdict, "institution");
  assert.ok(isKept(row.verdict));
  assert.equal(row.replacement, undefined);
});

test("the word 'target' does not match a Target brand theme", () => {
  const [row] = auditPlan([{ text: "Hit our local purchasing target with small-business vendors" }], profile, program);
  assert.deepEqual(row.termHits, []);
  assert.notEqual(row.verdict, "grounded");
});

test("a capitalised theme in the line does match (positive control)", () => {
  const [row] = auditPlan([{ text: "Polka night in the park" }], profile, program);
  assert.equal(row.verdict, "grounded");
  assert.equal(row.termHits.length, 1);
});

test("a generic line is struck and replaced like-for-like", () => {
  const [row] = auditPlan([{ text: "Small-business breakfast with the chamber of commerce" }], profile, program);
  assert.equal(row.verdict, "generic");
  assert.equal(isKept(row.verdict), false);
  assert.equal(row.replacement?.bucket, row.bucket);
});

test("a named partner that matches a Qloo place is grounded", () => {
  const [row] = auditPlan([{ text: "Supplier day with a local bakery", named: "Kringle Corner Bakery" }], profile, program);
  assert.equal(row.verdict, "grounded");
  assert.equal(row.matched?.source, "qloo");
});
