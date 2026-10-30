// Area place traits. Every response here is hand-written; none of it is Qloo API output.
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { auditPlan } from "../src/lib/audit";
import { addPartnerTraits, partnerEntity } from "../src/lib/partnerInsights";
import { buildProgram } from "../src/lib/plan";
import { buildProfile, fetchAreaTags } from "../src/lib/profile";
import { areaPlaceTags } from "../src/lib/qloo";
import { isIdentityTag, parseAreaTags, sharedTraits, traitLine, type AreaTag } from "../src/lib/qlooInsights";
import { townBySlug } from "../src/lib/towns";
import { entity, NORMAL_PLACES, profileOf } from "./fixtures";

const tag = (id: string, name: string, subtype: string, affinity = 0.9, extra: Record<string, unknown> = {}) => ({
  tag_id: id,
  name,
  subtype,
  types: ["urn:entity:place"],
  query: { affinity },
  ...extra,
});

const BODY = {
  results: {
    tags: [
      tag("urn:tag:genre:place:supper_club", "Supper club", "urn:tag:genre:place", 0.99),
      tag("urn:tag:customer_identity:qloo:locals", "Locals", "urn:tag:customer_identity:qloo", 0.99),
      tag("urn:tag:ambience:qloo:lively", "Lively", "urn:tag:ambience:qloo", 0.98),
      tag("urn:tag:customer_identity:qloo:families", "Families", "urn:tag:customer_identity:qloo", 0.98),
      tag("urn:tag:genre:place:restaurant", "Restaurant", "urn:tag:genre:place", 0.97),
      tag("urn:tag:ambience:qloo:casual", "Casual", "urn:tag:ambience:qloo", 0.97),
      tag("urn:tag:specialty_dish:place:cheese_curds", "Cheese curds", "urn:tag:specialty_dish:place", 0.96),
      tag("urn:tag:inclusivity:place:lgbtq_friendly", "LGBTQ+ friendly", "urn:tag:inclusivity:place", 0.95),
      tag("urn:tag:activities:place:hiking", "Hiking", "urn:tag:activities:place", 0.94),
    ],
  },
};

test("identity filter: customer-identity tags never survive, whichever field names them", () => {
  const names = parseAreaTags(BODY).map((t) => t.name);
  assert.ok(!names.includes("Locals"));
  assert.ok(!names.includes("Families"));
  assert.ok(!names.includes("LGBTQ+ friendly"));
  // By id alone, by types alone, and with an odd subtype spelling.
  assert.equal(isIdentityTag({ id: "urn:tag:customer_identity:qloo:young_adults" }), true);
  assert.equal(isIdentityTag({ id: "urn:tag:x:1", types: ["urn:tag:customer_identity:qloo"] }), true);
  assert.equal(isIdentityTag({ id: "urn:tag:x:2", subtype: "urn:tag:customer_identity:other" }), true);
  assert.equal(isIdentityTag({ id: "urn:tag:x:3", subtype: "urn:tag:inclusivity:place" }), true);
  assert.equal(isIdentityTag({ id: "urn:tag:payments:place:cash_only", subtype: "" }), true);
  assert.equal(isIdentityTag({ id: "urn:tag:ambience:qloo:lively", subtype: "urn:tag:ambience:qloo", types: ["urn:entity:place"] }), false);
  const parsed = parseAreaTags({
    results: {
      tags: [
        { tag_id: "urn:tag:customer_identity:qloo:tourists", name: "Tourists", query: { affinity: 1 } },
        tag("urn:tag:genre:place:wedding_venue", "Wedding venue", "urn:tag:genre:place", 0.9, { types: ["urn:tag:customer_identity:qloo"] }),
        tag("urn:tag:genre:place:x", "Church supper", "urn:tag:genre:place"),
        tag("urn:tag:genre:place:y", "Veteran-owned", "urn:tag:genre:place"),
        tag("urn:tag:genre:place:asian", "Asian", "urn:tag:genre:place"),
      ],
    },
  });
  assert.deepEqual(parsed.map((t) => t.name), ["Asian"]);
  for (const t of parseAreaTags(BODY)) assert.ok(!/identity|inclusivity/.test(`${t.id} ${t.subtype}`), t.id);
});

test("parser: generic tags are dropped, and ranks count only the traits kept", () => {
  const tags = parseAreaTags(BODY);
  assert.deepEqual(
    tags.map((t) => [t.rank, t.name]),
    [
      [1, "Supper club"],
      [2, "Lively"],
      [3, "Cheese curds"],
      [4, "Hiking"],
    ],
  );
  assert.equal(parseAreaTags(null).length, 0);
  assert.equal(parseAreaTags({ results: { tags: "x" } }).length, 0);
  // A repeated id is counted once; a tag without an id or a name is skipped.
  const dup = parseAreaTags({ results: { tags: [tag("a", "Lively", "urn:tag:ambience:qloo"), tag("a", "Lively", "urn:tag:ambience:qloo"), { name: "No id" }, { tag_id: "b" }] } });
  assert.deepEqual(dup.map((t) => t.id), ["a"]);
});

const AREA: AreaTag[] = parseAreaTags(BODY);

test("sharedTraits: matched on tag id, best-ranked first, at most two", () => {
  const place = entity("p9", "Riverside Supper Club", {
    tags: [
      { name: "Hiking", type: "urn:tag:activities:place", id: "urn:tag:activities:place:hiking" },
      { name: "Lively", type: "urn:tag:ambience:qloo", id: "urn:tag:ambience:qloo:lively" },
      { name: "Supper club", type: "urn:tag:genre:place", id: "urn:tag:genre:place:supper_club" },
      { name: "Locals", type: "urn:tag:customer_identity:qloo", id: "urn:tag:customer_identity:qloo:locals" },
    ],
  });
  assert.deepEqual(sharedTraits(place, AREA), [
    { name: "Supper club", rank: 1, of: 4 },
    { name: "Lively", rank: 2, of: 4 },
  ]);
  // Same name, different id: no match.
  assert.deepEqual(sharedTraits(entity("p10", "X", { tags: [{ name: "Lively", type: "urn:tag:ambience:qloo", id: "urn:tag:ambience:other:lively" }] }), AREA), []);
  // An identity tag the place carries can't match: it was never an area trait.
  assert.deepEqual(sharedTraits(entity("p11", "Y", { tags: [{ name: "Locals", id: "urn:tag:customer_identity:qloo:locals" }] }), AREA), []);
  assert.deepEqual(sharedTraits(place, []), []);
  assert.deepEqual(sharedTraits(place, undefined), []);
});

test("traitLine: one or two traits, and nothing without an overlap", () => {
  assert.equal(traitLine([{ name: "Lively", rank: 5, of: 31 }]), "Carries Lively, #5 of 31 place traits this area over-indexes on (Qloo)");
  assert.equal(
    traitLine([
      { name: "Supper club", rank: 1, of: 31 },
      { name: "Lively", rank: 5, of: 31 },
    ]),
    "Carries Supper club and Lively, #1 and #5 of 31 place traits this area over-indexes on (Qloo)",
  );
  assert.equal(traitLine([]), undefined);
  assert.equal(traitLine(undefined), undefined);
});

test("addPartnerTraits: only partners that carry an area trait get a line, and the program is unchanged", () => {
  const places = NORMAL_PLACES.map((p) =>
    p.id === "p1" ? { ...p, tags: [...p.tags, { name: "Lively", type: "urn:tag:ambience:qloo", id: "urn:tag:ambience:qloo:lively" }] } : p,
  );
  const profile = { ...profileOf(places), areaTags: AREA };
  const program = buildProgram(profile, 1_000_000);
  const audit = auditPlan([{ text: "Workforce night at the high school" }], profile, program.items);
  const before = JSON.stringify({ items: program.items, audit });
  addPartnerTraits(profile, program.items);
  const withTraits = program.items.filter((it) => it.partner?.traits);
  assert.ok(withTraits.length > 0);
  for (const it of withTraits) {
    assert.equal(partnerEntity(it, profile.places)?.id, "p1");
    assert.deepEqual(it.partner!.traits, [{ name: "Lively", rank: 2, of: 4 }]);
  }
  const strip = (s: string) => JSON.stringify(JSON.parse(s, (k, v) => (k === "traits" ? undefined : v)));
  assert.equal(strip(JSON.stringify({ items: program.items, audit })), strip(before));
  // No area traits: nothing is attached.
  const bare = profileOf(places);
  const p2 = buildProgram(bare, 1_000_000);
  addPartnerTraits(bare, p2.items);
  assert.ok(p2.items.every((it) => !it.partner?.traits));
});

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("client: the place-traits query sends the site point, place tags only, take 50", async () => {
  process.env.QLOO_API_KEY ??= "test-key";
  const urls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    urls.push(url);
    return new Response(JSON.stringify(BODY));
  }) as typeof fetch;
  const res = await areaPlaceTags(42.7117, -87.8836);
  const q = new URL(urls[0]).searchParams;
  assert.equal(q.get("filter.type"), "urn:tag");
  assert.equal(q.get("signal.location"), "POINT(-87.8836 42.7117)");
  assert.equal(q.get("filter.parents.types"), "urn:entity:place");
  assert.equal(q.get("take"), "50");
  assert.equal(res.call.ok, true);
  assert.equal(res.tags.length, 4);
});

test("isolation: a failed place-traits call adds nothing and leaves failedCalls untouched", async () => {
  process.env.QLOO_API_KEY ??= "test-key";
  const isTraits = (url: string) => new URL(url).searchParams.get("filter.type") === "urn:tag";
  globalThis.fetch = (async (url: string) => {
    if (isTraits(url)) return new Response("{}", { status: 500 });
    if (url.includes("/v2/audiences")) return new Response(JSON.stringify({ results: { audiences: [] } }));
    return new Response(JSON.stringify({ results: { entities: [{ entity_id: "p1", name: "Lakeside Community Center" }] } }));
  }) as typeof fetch;
  const direct = await fetchAreaTags({ lat: 42.7, lon: -87.9 });
  assert.deepEqual(direct.areaTags, []);
  assert.equal(direct.areaTagCalls.length, 1);
  assert.equal(direct.areaTagCalls[0].ok, false);

  const profile = await buildProfile(townBySlug("mount-pleasant-wi")!, { lenses: false });
  assert.deepEqual(profile.areaTags, []);
  assert.equal(profile.areaTagCalls!.length, 1);
  assert.equal(profile.areaTagCalls![0].status, 500);
  assert.equal(profile.failedCalls.length, 0);
  assert.ok(!profile.calls.some((c) => c.label === "place traits near point"));

  // A thrown fetch for the traits call is the same: no traits, no failed town call.
  globalThis.fetch = (async (url: string) => {
    if (isTraits(url)) throw new Error("network");
    return new Response(JSON.stringify({ results: { entities: [] } }));
  }) as typeof fetch;
  const thrown = await fetchAreaTags({ lat: 42.7, lon: -87.9 });
  assert.deepEqual(thrown.areaTags, []);
  assert.equal(thrown.areaTagCalls[0].ok, false);
});

test("traits: only the top half of the area's list is cited", () => {
  const area = Array.from({ length: 10 }, (_, k) => ({ id: `t${k + 1}`, name: `Trait ${k + 1}`, subtype: "urn:tag:ambience:qloo", affinity: 1 - k / 10, rank: k + 1 }));
  const place = entity("p20", "Z", { tags: [{ name: "Trait 8", id: "t8" }, { name: "Trait 3", id: "t3" }] });
  assert.deepEqual(sharedTraits(place, area), [{ name: "Trait 3", rank: 3, of: 10 }]);
  assert.deepEqual(sharedTraits(entity("p21", "W", { tags: [{ name: "Trait 9", id: "t9" }] }), area), []);
});

test("traits: only place-trait kinds survive; age ranges, hidden and neighbourhood tags never do", () => {
  const tag = (id: string, name: string, subtype: string, affinity: number) => ({ tag_id: id, name, subtype, query: { affinity } });
  const area = parseAreaTags({
    results: {
      tags: [
        tag("urn:tag:age_range:qloo:18_24", "18 24", "urn:tag:age_range:qloo", 0.99),
        tag("urn:tag:not_for_display:place:mask_required", "Mask required", "urn:tag:not_for_display:place", 0.98),
        tag("urn:tag:neighborhood_characteristic:qloo:family_friendly", "Family friendly", "urn:tag:neighborhood_characteristic:qloo", 0.97),
        tag("urn:tag:genre:place:latino_owned", "Latino-owned", "urn:tag:genre:place", 0.96),
        tag("urn:tag:category:place:bakery", "Bakery", "urn:tag:category:place", 0.9),
        tag("urn:tag:offerings:place:bakery", "Bakery", "urn:tag:offerings:place", 0.8),
        tag("urn:tag:ambience:qloo:lively", "Lively", "urn:tag:ambience:qloo", 0.7),
      ],
    },
  });
  assert.deepEqual(area.map((t) => [t.name, t.rank]), [["Bakery", 1], ["Lively", 2]]);
});

