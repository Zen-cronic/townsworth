import assert from "node:assert/strict";
import { test } from "node:test";
import { buildProgram, OPEN_GRANT_ID, type Program } from "../src/lib/plan";
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

test("a thin profile with no places: only the open grant cycle is itemized, the rest is reserve", () => {
  const fund = 500_000;
  const p = buildProgram(profileOf([], { thin: true }), fund);
  assert.deepEqual(p.items.map((i) => i.id), [OPEN_GRANT_ID]);
  assert.equal(p.items[0].partner, undefined);
  assert.equal(p.unassigned, 2 * fund - p.items[0].amount);
  assertReconciles(p, fund);
});

test("when Qloo failed, nothing is itemized, not even the open cycle", () => {
  const fund = 500_000;
  const profile = profileOf([], { thin: true });
  profile.failedCalls = [{ label: "places", params: {}, status: 0, ok: false, count: 0, ms: 0 }];
  const p = buildProgram(profile, fund);
  assert.equal(p.items.length, 0);
  assertReconciles(p, fund);
});
