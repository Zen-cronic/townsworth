// Age-group check. Every place and lens list here is hand-written; none of it is Qloo API output.
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { auditPlan } from "../src/lib/audit";
import { buildProgram, isReachItem, type Program } from "../src/lib/plan";
import { fetchLenses, type TownProfile } from "../src/lib/profile";
import { checkAdditions, programPartners } from "../src/lib/proof";
import { applyReach, isLensHost, type LensData } from "../src/lib/reach";
import { auditDraft } from "../src/lib/run";
import { entity, NORMAL_PLACES, profileOf } from "./fixtures";

// Beyond NORMAL_PLACES (all of which the program uses): two eligible hosts the program doesn't pick
// (a beach, a high school) and three places that are never hosts.
const EXTRA = [
  entity("p7", "Sandy Point Beach", { cats: ["Beach"], distanceM: 3000 }),
  entity("p8", "Westview High School", { cats: ["High school"], distanceM: 4100 }),
  entity("p9", "Corner Tap", { cats: ["Bar"], distanceM: 1200 }),
  entity("p10", "FitLife Gym", { cats: ["Gym"], distanceM: 1500 }),
  entity("p11", "Lakeside Café", { cats: ["Park", "Cafe"], distanceM: 1700 }),
];

function withLenses(lenses: LensData[], fund = 1_000_000) {
  const profile = profileOf([...NORMAL_PLACES, ...EXTRA]);
  profile.lenses = lenses;
  profile.lensCalls = lenses.map((l) => ({ label: l.key, params: {}, status: l.ok ? 200 : 500, ok: l.ok, count: l.ids.length, ms: 1 }));
  const program = buildProgram(profile, fund);
  return { profile, program };
}

const all = (ids: string[]): LensData[] => [
  { key: "young-adults", ok: true, ids },
  { key: "older", ok: true, ids },
  { key: "families", ok: true, ids },
];

// The program as built still reconciles, and the earmarked sessions fit inside the reserve.
function assertReconciles(p: Program) {
  const itemSum = p.items.reduce((s, it) => s + it.amount, 0);
  assert.equal(p.totalAllocated, itemSum);
  assert.ok(p.unassigned >= 0);
  assert.equal(itemSum + p.unassigned, p.twoYearFund);
  const earmarked = (p.reachItems ?? []).reduce((s, it) => s + it.amount, 0);
  assert.equal(p.reachEarmarked ?? 0, earmarked);
  assert.ok(earmarked <= p.unassigned);
  assert.ok(!p.items.some(isReachItem));
  for (const it of [...p.items, ...(p.reachItems ?? [])]) assert.equal(it.amount, it.sessions * it.unitCost, it.id);
  const grants = p.items.filter((it) => it.bucket === "grants" && it.partner);
  for (const g of grants) assert.ok(g.unitCost <= 100_000, g.id);
}

test("a lens a program partner already appears in is covered: nothing is added", () => {
  const { profile, program } = withLenses(all(["p9", "p5", "p8"]));
  const before = program.items.length;
  applyReach(profile, program);
  assert.equal(program.items.length, before);
  assert.deepEqual(program.reachItems, []);
  assert.ok(program.reach!.every((o) => o.status === "covered"));
  assert.equal(program.reach![0].partners![0].name, "River Bend Museum");
  assert.equal(program.reach![0].partners![0].lensRank, 2);
});

test("an uncovered lens adds exactly one reach- session at an eligible host, earmarked from the reserve", () => {
  const lenses = all(["p3", "p9", "p10", "p11", "p8", "p7"]);
  lenses[1].ids = ["p1"];
  lenses[2].ids = ["p5"];
  const { profile, program } = withLenses(lenses);
  const before = JSON.stringify({ items: program.items, unassigned: program.unassigned, total: program.totalAllocated, picks: program.picks });
  applyReach(profile, program);
  const added = program.reachItems!;
  assert.equal(added.length, 1);
  const item = added[0];
  // The bakery, bar, gym and park café rank higher but are not hosts; the school is the best eligible one.
  assert.equal(item.id, "reach-young-adults");
  assert.equal(item.partner?.name, "Westview High School");
  assert.equal(item.bucket, "events");
  assert.equal(item.sessions, 1);
  assert.match(item.detail, /^Added so the program includes a place young adults \(under 25\) favour \(Qloo, aggregate\)/);
  // Nothing the existing counts read has moved.
  assert.equal(JSON.stringify({ items: program.items, unassigned: program.unassigned, total: program.totalAllocated, picks: program.picks }), before);
  assert.equal(program.reachEarmarked, item.amount);
  const outcome = program.reach!.find((o) => o.key === "young-adults")!;
  assert.equal(outcome.status, "added");
  assert.equal(outcome.place?.lensRank, 5);
  assert.deepEqual(program.reach!.filter((o) => o.key !== "young-adults").map((o) => o.status), ["covered", "covered"]);
  assertReconciles(program);
});

test("an adult-only partner doesn't cover families or young adults, but does cover older residents", () => {
  const { profile, program } = withLenses(all(["p4", "p7"]));
  applyReach(profile, program);
  const status = Object.fromEntries(program.reach!.map((o) => [o.key, o.status]));
  assert.deepEqual(status, { "young-adults": "added", older: "covered", families: "added" });
  assert.deepEqual(program.reachItems!.map((it) => it.partner?.name), ["Sandy Point Beach", "Sandy Point Beach"]);
  assertReconciles(program);
});

test("when the session doesn't fit in the reserve it is skipped and said so", () => {
  const { profile, program } = withLenses(all(["p8"]), 20_000);
  const before = program.items.map((it) => it.id);
  const unassigned = program.unassigned;
  applyReach(profile, program);
  assert.deepEqual(program.items.map((it) => it.id), before);
  assert.equal(program.unassigned, unassigned);
  assert.deepEqual(program.reachItems, []);
  assert.ok(program.reach!.every((o) => o.status === "no-fit"));
  assert.match(program.reach![0].note, /doesn't fit in the reserve/);
  assertReconciles(program);
});

test("no eligible host in the lens list: nothing added", () => {
  const { profile, program } = withLenses(all(["p3", "p9", "p10", "p11"]));
  applyReach(profile, program);
  assert.deepEqual(program.reachItems, []);
  assert.ok(program.reach!.every((o) => o.status === "no-candidate"));
});

test("a failed lens call is 'couldn't check': failedCalls untouched, nothing added", () => {
  const lenses = all(["p8"]);
  lenses[2] = { key: "families", ok: false, ids: [] };
  lenses[0].ids = ["p1"];
  lenses[1].ids = ["p1"];
  const { profile, program } = withLenses(lenses);
  applyReach(profile, program);
  assert.equal(profile.failedCalls.length, 0);
  assert.equal(profile.lensCalls!.filter((c) => !c.ok).length, 1);
  assert.equal(program.reach!.find((o) => o.key === "families")!.status, "unchecked");
  assert.deepEqual(program.reachItems, []);
});

test("when the town's own Qloo calls failed, every lens is unchecked and nothing is added", () => {
  const { profile, program } = withLenses(all(["p8"]));
  profile.failedCalls = [{ label: "places", params: {}, status: 0, ok: false, count: 0, ms: 0 }];
  applyReach(profile, program);
  assert.ok(program.reach!.every((o) => o.status === "unchecked"));
  assert.equal(program.reachItems, undefined);
});

test("a profile without lens data leaves the program exactly as built", () => {
  const profile = profileOf(NORMAL_PLACES);
  const program = buildProgram(profile, 1_000_000);
  const snapshot = JSON.stringify(program);
  applyReach(profile, program);
  assert.equal(JSON.stringify(program), snapshot);
});

test("host rules: halls, parks, beaches, museums, schools; never dining, bars, gyms or retail", () => {
  assert.ok(isLensHost(entity("a", "Town Library", { cats: ["Public library"] })));
  assert.ok(isLensHost(entity("b", "Pike River Park", { cats: ["Park"] })));
  assert.ok(isLensHost(entity("c", "Harbour Museum", { cats: ["Museum", "Gift shop"] })));
  assert.ok(!isLensHost(entity("d", "Lakeside Café", { cats: ["Park", "Cafe"] })));
  assert.ok(!isLensHost(entity("e", "FitLife Gym", { cats: ["Gym"] })));
  assert.ok(!isLensHost(entity("f", "Brew Hall", { cats: ["Banquet hall", "Brewery"] })));
  assert.ok(!isLensHost(entity("g", "Kids Toy Store", { cats: ["Toy store", "Park"] })));
  assert.ok(!isLensHost(entity("h", "Kringle Corner Bakery", { cats: ["Bakery"] })));
  assert.ok(!isLensHost(entity("i", "Country Club", { cats: ["Banquet hall", "Country club"] })));
});

function reachProgram(): { profile: TownProfile; program: Program } {
  const lenses = all(["p8"]);
  const { profile, program } = withLenses(lenses);
  applyReach(profile, program);
  // reach- sessions never enter `items`. Put one at the front anyway, so each guard is exercised.
  program.items.unshift(...program.reachItems!);
  return { profile, program };
}

test("guards: even inside items, reach- sessions are never a like-for-like swap, an addition, a run-with target or a suggested partner", () => {
  const { profile, program } = reachProgram();
  assert.ok(isReachItem(program.items[0]));
  const audit = auditPlan([{ text: "Host an annual community picnic at the county fairgrounds" }], profile, program.items);
  assert.equal(audit[0].bucket, "events");
  assert.ok(!audit[0].replacement || !isReachItem(audit[0].replacement));
  const { audit: rows, qlooAdds } = auditDraft(
    [
      { text: "Fall festival run with the county EDC", named: "Racine County Economic Development Corporation", osm: { found: false } },
      { text: "Jazz night in the park" },
    ],
    profile,
    program,
  );
  assert.ok(!qlooAdds.some(isReachItem));
  assert.ok(rows.every((r) => !(r.replacement && isReachItem(r.replacement)) && !(r.alongside && isReachItem(r.alongside))));
  assert.ok(program.items.filter(isReachItem).every((it) => !it.runWith));
});

test("guards: even inside items, reach- sessions stay out of the /proof partner and replacement figures", () => {
  const { program } = reachProgram();
  const names = programPartners(program.items);
  assert.ok(!names.includes("Westview High School"));
  assert.equal(names.length, program.items.filter((it) => it.partner && !isReachItem(it)).length);
  const fake = [{ text: "x", bucket: "events" as const, verdict: "generic" as const, reasons: [], termHits: [], replacement: program.items[0] }];
  assert.equal(checkAdditions(fake).length, 0);
});

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("lens fetch: the life-stage id is read at runtime; an audience failure is a lens call, not a failed call", async () => {
  process.env.QLOO_API_KEY ??= "test-key";
  const urls: string[] = [];
  const places = { results: { entities: [{ entity_id: "p8", name: "Westview High School" }] } };
  globalThis.fetch = (async (url: string) => {
    urls.push(url);
    if (url.includes("/v2/audiences")) {
      return new Response(JSON.stringify({ results: { audiences: [{ id: "urn:audience:life_stage:parents_with_young_children", name: "Parents With Young Children" }] } }));
    }
    return new Response(JSON.stringify(places));
  }) as typeof fetch;
  const ok = await fetchLenses({ lat: 42.7, lon: -87.9 });
  assert.deepEqual(ok.lenses.map((l) => [l.key, l.ok, l.ids]), [
    ["young-adults", true, ["p8"]],
    ["older", true, ["p8"]],
    ["families", true, ["p8"]],
  ]);
  const insights = urls.filter((u) => u.includes("/v2/insights")).map((u) => new URL(u).searchParams);
  assert.equal(insights.length, 3);
  for (const q of insights) {
    assert.equal(q.get("take"), "15");
    assert.equal(q.get("filter.location.radius"), "15000");
    const demo = [...q.keys()].filter((k) => k.startsWith("signal.demographics"));
    assert.equal(demo.length, 1);
    assert.ok(["signal.demographics.age", "signal.demographics.audiences"].includes(demo[0]));
  }
  assert.equal(insights[2].get("signal.demographics.audiences"), "urn:audience:life_stage:parents_with_young_children");

  globalThis.fetch = (async (url: string) =>
    url.includes("/v2/audiences") ? new Response("{}", { status: 500 }) : new Response(JSON.stringify(places))) as typeof fetch;
  const failed = await fetchLenses({ lat: 42.7, lon: -87.9 });
  assert.equal(failed.lenses.find((l) => l.key === "families")!.ok, false);
  assert.equal(failed.lensCalls.filter((c) => !c.ok).length, 1);
});
