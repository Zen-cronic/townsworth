// Partner audience age profiles. Every response here is hand-written; none of it is Qloo API output.
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { auditPlan } from "../src/lib/audit";
import { addPartnerAges, partnerEntity } from "../src/lib/partnerInsights";
import { buildProgram } from "../src/lib/plan";
import { partnerDemographics } from "../src/lib/qloo";
import { ageLine, ageSkewLabel, parseDemographics, type AgeProfile } from "../src/lib/qlooInsights";
import { applyReach } from "../src/lib/reach";
import { NORMAL_PLACES, profileOf } from "./fixtures";

const age = (v: Partial<AgeProfile> = {}): AgeProfile => ({
  "24_and_younger": 0,
  "25_to_29": 0,
  "30_to_34": 0,
  "35_to_44": 0,
  "45_to_54": 0,
  "55_and_older": 0,
  ...v,
});

const row = (id: string, a: Partial<AgeProfile>, extra: Record<string, unknown> = {}) => ({
  entity_id: id,
  query: { age: age(a), gender: { male: 0.4, female: -0.4 }, ...extra },
});

test("parser: reads only the six age buckets and drops gender", () => {
  const out = parseDemographics({ results: { demographics: [row("p1", { "55_and_older": 0.42, "24_and_younger": -0.3 })] } });
  assert.equal(out.size, 1);
  const p1 = out.get("p1")!;
  assert.deepEqual(Object.keys(p1).sort(), ["24_and_younger", "25_to_29", "30_to_34", "35_to_44", "45_to_54", "55_and_older"]);
  assert.equal(p1["55_and_older"], 0.42);
  assert.ok(!("gender" in p1) && !("male" in p1) && !("female" in p1));
  assert.ok(!JSON.stringify([...out.values()]).includes("male"));
});

test("parser: a row without a full numeric age profile is dropped, never read as zero", () => {
  const out = parseDemographics({
    results: {
      demographics: [
        { entity_id: "p1", query: { gender: { male: 0.1 } } },
        { entity_id: "p2", query: { age: { "24_and_younger": 0.2 } } },
        { entity_id: "p3", query: { age: { ...age(), "45_to_54": "high" } } },
        { query: { age: age() } },
        row("p4", { "30_to_34": 0.2 }),
      ],
    },
  });
  assert.deepEqual([...out.keys()], ["p4"]);
  assert.equal(parseDemographics(null).size, 0);
  assert.equal(parseDemographics({ results: {} }).size, 0);
  assert.equal(parseDemographics({ results: { demographics: "x" } }).size, 0);
});

test("ageSkewLabel: the top bucket at 0.15 or more, otherwise a broad mix", () => {
  assert.equal(ageSkewLabel(age({ "55_and_older": 0.15, "45_to_54": 0.1 })), "55 and older");
  assert.equal(ageSkewLabel(age({ "24_and_younger": 0.31, "25_to_29": 0.3 })), "under 25");
  assert.equal(ageSkewLabel(age({ "35_to_44": 0.149 })), "broad age mix");
  assert.equal(ageSkewLabel(age({ "24_and_younger": -0.4, "55_and_older": -0.1 })), "broad age mix");
  assert.equal(ageSkewLabel(undefined), undefined);
  assert.equal(ageLine(age({ "55_and_older": 0.4 })), "Qloo audience data: over-indexes with 55 and older");
  assert.equal(ageLine(age()), "Qloo audience data: broad age mix");
  assert.equal(ageLine(undefined), undefined);
});

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("client: at most 15 deduped ids, sorted, in batches of 5", async () => {
  process.env.QLOO_API_KEY ??= "test-key";
  const sent: string[][] = [];
  globalThis.fetch = (async (url: string) => {
    const ids = new URL(url).searchParams.get("signal.interests.entities")!.split(",");
    sent.push(ids);
    assert.equal(new URL(url).searchParams.get("filter.type"), "urn:demographics");
    return new Response(JSON.stringify({ results: { demographics: ids.includes("a") ? [row("a", { "55_and_older": 0.3 })] : [] } }));
  }) as typeof fetch;
  const ids = ["a", "a", ...Array.from({ length: 20 }, (_, i) => `id${String(i).padStart(2, "0")}`)];
  const res = await partnerDemographics(ids);
  assert.deepEqual(sent.map((b) => b.length), [5, 5, 5]);
  const all = sent.flat();
  assert.equal(new Set(all).size, 15);
  assert.ok(all.includes("a"), "the first-priority partner is inside the cap");
  assert.deepEqual(all, [...all].sort());
  assert.deepEqual([...res.ages.keys()], ["a"]);
  assert.equal(res.calls.length, 3);
  assert.ok(res.calls.every((c) => c.ok));
  assert.equal((await partnerDemographics([])).calls.length, 0);
});

test("client: the same partners in any order make the same requests", async () => {
  process.env.QLOO_API_KEY ??= "test-key";
  const seen: string[] = [];
  globalThis.fetch = (async (url: string) => {
    seen.push(new URL(url).searchParams.get("signal.interests.entities")!);
    return new Response(JSON.stringify({ results: { demographics: [] } }));
  }) as typeof fetch;
  await partnerDemographics(["c", "a", "b"]);
  await partnerDemographics(["b", "c", "a"]);
  assert.deepEqual(seen, ["a,b,c", "a,b,c"]);
});

test("isolation: a failed age call attaches nothing and leaves failedCalls, verdicts and amounts as they were", async () => {
  process.env.QLOO_API_KEY ??= "test-key";
  const build = () => {
    const profile = profileOf(NORMAL_PLACES);
    const program = buildProgram(profile, 1_000_000);
    const audit = auditPlan([{ text: "Workforce night at the high school" }, { text: "Arts grant", named: null }], profile, program.items);
    applyReach(profile, program);
    return { profile, program, audit };
  };
  const before = build();
  const snapshot = JSON.stringify({ items: before.program.items, audit: before.audit, total: before.program.totalAllocated, unassigned: before.program.unassigned });

  globalThis.fetch = (async () => new Response("{}", { status: 500 })) as typeof fetch;
  const failed = build();
  // Seed the town's own call lists, so the check below can fail if the age call writes to them.
  const own = { label: "places near point", params: {}, status: 200, ok: true, count: 5, ms: 1 };
  failed.profile.calls = [own];
  failed.profile.failedCalls = [];
  await addPartnerAges(failed.profile, failed.program.items);
  assert.deepEqual(failed.profile.failedCalls, []);
  assert.deepEqual(failed.profile.calls, [own]);
  assert.equal(failed.profile.ageCalls!.length, 1);
  assert.equal(failed.profile.ageCalls![0].ok, false);
  assert.equal(failed.profile.partnerAges!.size, 0);
  assert.ok(failed.program.items.every((it) => !it.partner?.ages));
  assert.equal(JSON.stringify({ items: failed.program.items, audit: failed.audit, total: failed.program.totalAllocated, unassigned: failed.program.unassigned }), snapshot);

  // No answer at all (a thrown fetch) behaves the same.
  globalThis.fetch = (async () => {
    throw new Error("network");
  }) as typeof fetch;
  const thrown = build();
  await addPartnerAges(thrown.profile, thrown.program.items);
  assert.equal(thrown.profile.failedCalls.length, 0);
  assert.ok(thrown.program.items.every((it) => !it.partner?.ages));

  // A good answer attaches the row to the matching partner only; nothing else changes.
  globalThis.fetch = (async () => new Response(JSON.stringify({ results: { demographics: [row("p1", { "55_and_older": 0.5 })] } }))) as typeof fetch;
  const ok = build();
  await addPartnerAges(ok.profile, ok.program.items);
  const withAge = ok.program.items.filter((it) => it.partner?.ages);
  assert.ok(withAge.length > 0);
  assert.ok(withAge.every((it) => partnerEntity(it, ok.profile.places)?.id === "p1"));
  assert.equal(ok.profile.failedCalls.length, 0);
  const stripped = JSON.parse(JSON.stringify(ok.program.items), (k, v) => (k === "ages" ? undefined : v));
  assert.equal(JSON.stringify({ items: stripped, audit: JSON.parse(JSON.stringify(ok.audit), (k, v) => (k === "ages" ? undefined : v)), total: ok.program.totalAllocated, unassigned: ok.program.unassigned }), snapshot);
});

test("partnerEntity: matches a partner to its Qloo place by name, address and distance", () => {
  const profile = profileOf(NORMAL_PLACES);
  const program = buildProgram(profile, 1_000_000);
  for (const it of program.items.filter((i) => i.partner)) {
    const e = partnerEntity(it, profile.places);
    assert.ok(e, it.partner!.name);
    assert.equal(e.name.split(" | ")[0], it.partner!.name);
  }
});
