import assert from "node:assert/strict";
import { test } from "node:test";
import { buildProgram, type Program } from "../src/lib/plan";
import { NORMAL_PLACES, profileOf } from "./fixtures";

function assertReconciles(p: Program, annualFund: number) {
  const itemSum = p.items.reduce((s, it) => s + it.amount, 0);
  assert.equal(p.twoYearFund, 2 * annualFund);
  assert.equal(p.totalAllocated, itemSum);
  assert.ok(p.unassigned >= 0);
  assert.equal(itemSum + p.unassigned, 2 * annualFund);
  for (const it of p.items) assert.equal(it.amount, it.sessions * it.unitCost, it.id);
}

test("a normal profile: items plus unassigned equal twice the annual fund", () => {
  const fund = 2_000_000;
  const p = buildProgram(profileOf(NORMAL_PLACES, { artists: ["Polka Band", "Lake Trio"] }), fund);
  assert.ok(p.items.some((i) => i.bucket === "training"));
  assert.ok(p.items.some((i) => i.bucket === "procurement"));
  assert.ok(p.items.some((i) => i.bucket === "grants"));
  assert.ok(p.items.some((i) => i.id === "events-music"));
  assertReconciles(p, fund);
});

test("a small fund scales unit costs down and still reconciles", () => {
  const fund = 20_000;
  const p = buildProgram(profileOf(NORMAL_PLACES, { artists: ["Polka Band"] }), fund);
  assertReconciles(p, fund);
  assert.match(p.costNote, /scaled down/);
});

test("a thin profile with no places: nothing itemized, the whole fund unassigned", () => {
  const fund = 500_000;
  const p = buildProgram(profileOf([], { thin: true }), fund);
  assert.equal(p.items.length, 0);
  assert.equal(p.unassigned, 2 * fund);
  assertReconciles(p, fund);
});
