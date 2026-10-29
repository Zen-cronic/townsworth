// Qloo name search on /check. Search responses here are hand-written; none of it is Qloo API output.
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { auditPlan, matchSearchHit } from "../src/lib/audit";
import { buildProgram } from "../src/lib/plan";
import { searchPlaces } from "../src/lib/qloo";
import { qlooSearchChecks } from "../src/lib/userPlan";
import { entity, NORMAL_PLACES, profileOf } from "./fixtures";

const SITE = { name: "Mount Pleasant", lat: 42.7117, lon: -87.8836 };
// About 8 km and 38 km from SITE.
const NEAR = { lat: 42.748, lon: -87.7845 };
const FAR = { lat: 43.0315, lon: -88.0403 };

const hit = (id: string, name: string, location: { lat: number; lon: number }, address?: string) => entity(id, name, { location, address });

test("search: a same-name place within 25 km verifies the partner", () => {
  const m = matchSearchHit("Lakeview Zoo", [hit("s1", "Lakeview Zoo", NEAR, "2131 N Main St Racine, WI 53402")], SITE);
  assert.ok(m);
  assert.equal(m.name, "Lakeview Zoo");
  assert.ok(m.km > 7 && m.km < 10, String(m.km));
});

test("search: a namesake with an extra distinctive word is rejected", () => {
  assert.equal(matchSearchHit("Lakeview Zoo", [hit("s2", "Lakeview Zoo Beach", NEAR)], SITE), null);
  // With both in the results, the exact one wins.
  assert.equal(matchSearchHit("Lakeview Zoo", [hit("s2", "Lakeview Zoo Beach", NEAR), hit("s1", "Lakeview Zoo", NEAR)], SITE)?.name, "Lakeview Zoo");
});

test("search: a same-name place beyond 25 km is rejected, and a city suffix is not a new word", () => {
  assert.equal(matchSearchHit("Harbor County Zoo", [hit("s3", "Harbor County Zoo", FAR)], SITE), null);
  assert.equal(matchSearchHit("Gateway Technical College", [hit("s4", "Gateway Technical College Racine Campus", NEAR, "1001 Main St Racine, WI 53403")], SITE)?.name, "Gateway Technical College Racine Campus");
  // A different body sharing only form words is not the partner.
  assert.equal(matchSearchHit("Village Board", [hit("s5", "Village Board Hall", NEAR)], SITE), null);
});

test("audit: a search match turns an unverified line into a Qloo-verified partner", () => {
  const profile = profileOf(NORMAL_PLACES);
  const program = buildProgram(profile, 1_000_000);
  const line = { text: "Family day with Riverside Roller Rink", named: "Riverside Roller Rink", osm: { found: false } };
  const [before] = auditPlan([line], profile, program.items);
  assert.equal(before.verdict, "unverified");
  const [after] = auditPlan([{ ...line, qloo: { name: "Riverside Roller Rink", km: 8.4 } }], profile, program.items);
  assert.equal(after.verdict, "grounded");
  assert.deepEqual(after.matched, { name: "Riverside Roller Rink", distanceKm: 8.4, source: "qloo-search" });
  assert.ok(after.reasons.includes("Qloo knows this place · 8.4 km"));
});

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("searchPlaces is never cached and sends only the name and the site", async () => {
  process.env.QLOO_API_KEY ??= "test-key";
  const seen: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    seen.push({ url, init });
    return new Response(JSON.stringify({ results: [{ entity_id: "s1", name: "Lakeview Zoo", location: NEAR }] }));
  }) as typeof fetch;
  const res = await searchPlaces("Lakeview Zoo", SITE.lat, SITE.lon);
  assert.equal(res.ok, true);
  assert.equal(res.entities[0].name, "Lakeview Zoo");
  assert.equal(seen.length, 1);
  assert.equal(seen[0].init?.cache, "no-store");
  assert.equal((seen[0].init as { next?: unknown }).next, undefined);
  const q = new URL(seen[0].url).searchParams;
  assert.deepEqual(Object.fromEntries(q), {
    query: "Lakeview Zoo",
    types: "urn:entity:place",
    "filter.location": `${SITE.lat},${SITE.lon}`,
    "filter.radius": "25",
    take: "5",
  });
});

test("a search that throws (no key) counts as a failure instead of failing the check", async () => {
  const key = process.env.QLOO_API_KEY;
  delete process.env.QLOO_API_KEY;
  try {
    const profile = profileOf(NORMAL_PLACES);
    const search = await qlooSearchChecks([{ text: "Family day with Riverside Roller Rink", named: "Riverside Roller Rink", osm: { found: false } }], profile, profile.town);
    assert.deepEqual([search.checked, search.failures], [1, 1]);
  } finally {
    if (key !== undefined) process.env.QLOO_API_KEY = key;
  }
});

test("a failed search leaves the line unverified and doesn't throw; known places are not searched", async () => {
  process.env.QLOO_API_KEY ??= "test-key";
  const urls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    urls.push(url);
    return new Response("{}", { status: 500 });
  }) as typeof fetch;
  const profile = profileOf(NORMAL_PLACES);
  const inputs = [
    { text: "Family day with Riverside Roller Rink", named: "Riverside Roller Rink", osm: { found: false } },
    { text: "Training night at the community center", named: "Lakeside Community Center", osm: null },
  ];
  const search = await qlooSearchChecks(inputs, profile, profile.town);
  assert.equal(search.checked, 1);
  assert.equal(search.failures, 1);
  assert.equal(urls.length, 1);
  const program = buildProgram(profile, 1_000_000);
  const rows = auditPlan(
    inputs.map((i) => ({ ...i, qloo: search.matches.get("riverside roller rink") ?? null })),
    profile,
    program.items,
  );
  assert.equal(rows[0].verdict, "unverified");
  assert.equal(rows[1].matched?.source, "qloo");
});
