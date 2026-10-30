import assert from "node:assert/strict";
import { test } from "node:test";
import { isQlooSignal, shortSignal } from "../src/components/ui/labels";
import { buildProgram } from "../src/lib/plan";
import { NORMAL_PLACES, profileOf } from "./fixtures";

test("labels: every planner signal but the open call is a Qloo signal", () => {
  const program = buildProgram(profileOf(NORMAL_PLACES), 1_000_000);
  const signals = program.items.flatMap((it) => it.provenance.map((p) => p.signal));
  assert.ok(signals.length > 0);
  for (const s of signals) assert.equal(isQlooSignal(s), !s.startsWith("Open call"), s);
});

test("labels: Qloo signal shapes, and anything else is not", () => {
  assert.ok(isQlooSignal("Local favourite · #4 by local affinity"));
  assert.ok(isQlooSignal("Local place (Qloo) · 1.2 km away"));
  assert.ok(isQlooSignal("Qloo brand · #2 locally"));
  assert.ok(isQlooSignal("Favoured by young adults · #3 of 15 (Qloo, aggregate)"));
  assert.ok(isQlooSignal(undefined));
  assert.equal(isQlooSignal("Open call · no named partner"), false);
  assert.equal(isQlooSignal("Kept from the draft"), false);
});

test("labels: a Qloo brand signal shows only its local rank; other entity types keep their plain word", () => {
  assert.equal(shortSignal("Qloo brand · #2 locally"), "#2 locally");
  assert.equal(shortSignal("Qloo artist · #3 locally"), "artist · #3 locally");
  assert.equal(shortSignal("Local favourite · #4 by local affinity"), "#4 local affinity");
});
