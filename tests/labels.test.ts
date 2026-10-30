import assert from "node:assert/strict";
import { test } from "node:test";
import { isQlooSignal, LOCAL_AFFINITY, shortSignal } from "../src/components/ui/labels";
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
  assert.equal(shortSignal("Qloo brand · #2 locally"), "Locals' #2 favourite");
  assert.equal(shortSignal("Qloo artist · #3 locally"), "Locals' #3 artist");
  assert.equal(shortSignal("Local favourite · #4 by local affinity"), "Locals' #4 place");
});

test("labels: the signals the plan writes read in plain words, and brand never shows", () => {
  assert.equal(shortSignal("Local favourite · #24 of 50 places locals favour"), "#24 of 50 places locals favour");
  assert.equal(shortSignal("Qloo · locals' #2 favourite"), "Locals' #2 favourite");
  assert.equal(shortSignal("Qloo · locals' #3 TV show"), "Locals' #3 TV show");
  assert.ok(isQlooSignal("Local favourite · #24 of 50 places locals favour"));
  assert.ok(isQlooSignal("Qloo · locals' #2 favourite"));
  assert.equal(LOCAL_AFFINITY.exec("Local favourite · #24 of 50 places locals favour")?.slice(1, 3).join(), "24,50");
  assert.equal(LOCAL_AFFINITY.exec("Qloo place · #4 by local affinity")?.[1], "4");
  const program = buildProgram(profileOf(NORMAL_PLACES), 1_000_000);
  for (const it of program.items) {
    for (const p of it.provenance) {
      assert.doesNotMatch(shortSignal(p.signal), /\bbrand\b|affinity/i, p.signal);
      assert.doesNotMatch(p.signal, /\bbrand\b|affinity/i, p.signal);
    }
  }
});
