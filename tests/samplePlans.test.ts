import assert from "node:assert/strict";
import { test } from "node:test";
import { HERO_SAMPLE_ID, sampleCheckHref, samplePlanById, SAMPLE_PLANS } from "../src/lib/samplePlans";
import { MAX_CHARS, MAX_ITEMS, MIN_CHARS, SAMPLE_PLAN, splitPlanLines, validateCheckInput } from "../src/lib/userPlanParse";
import { townBySlug } from "../src/lib/towns";

test("every sample id resolves, and unknown or malformed ids don't", () => {
  assert.ok(SAMPLE_PLANS.length >= 2);
  for (const s of SAMPLE_PLANS) assert.equal(samplePlanById(s.id), s);
  assert.equal(samplePlanById(HERO_SAMPLE_ID)?.town, "mount-pleasant-wi");
  assert.equal(samplePlanById("generic")?.text, SAMPLE_PLAN);
  for (const bad of ["", "nope", "Mount-Pleasant", "generic ", undefined, null, 42, ["generic"]]) {
    assert.equal(samplePlanById(bad), undefined, String(bad));
  }
  assert.equal(new Set(SAMPLE_PLANS.map((s) => s.id)).size, SAMPLE_PLANS.length, "ids are unique");
});

test("every sample fits the parser's bounds and names a preset town", () => {
  for (const s of SAMPLE_PLANS) {
    assert.ok(s.text.trim().length >= MIN_CHARS, `${s.id} is too short`);
    assert.ok(s.text.length <= MAX_CHARS, `${s.id} is too long`);
    assert.ok(s.label.length > 0);
    const town = townBySlug(s.town);
    assert.ok(town && !town.custom, `${s.id} has no preset town`);
    const check = validateCheckInput({ town: s.town, text: s.text });
    assert.equal(check.ok, true, s.id);
    const { items, truncated } = splitPlanLines(s.text);
    assert.equal(truncated, false);
    assert.ok(items.length >= 5 && items.length <= MAX_ITEMS, `${s.id} splits into ${items.length} items`);
  }
});

test("the hero sample has ten commitments under its heading", () => {
  const s = samplePlanById(HERO_SAMPLE_ID)!;
  const { items } = splitPlanLines(s.text);
  assert.equal(items.length, 10);
  assert.ok(!items.some((i) => /\(draft\)$/.test(i)), "the heading is not an item");
});

test("the /check link carries the sample id and never the plan text", () => {
  for (const s of SAMPLE_PLANS) {
    const href = sampleCheckHref(s.id);
    assert.equal(href, `/check?sample=${s.id}`);
    const withTown = new URL(sampleCheckHref(s.id, "clay-ny"), "http://x");
    assert.equal(withTown.pathname, "/check");
    assert.deepEqual([...withTown.searchParams.keys()].sort(), ["sample", "town"]);
    assert.equal(withTown.searchParams.get("sample"), s.id);
    assert.equal(withTown.searchParams.get("town"), "clay-ny");
    const decoded = decodeURIComponent(href).toLowerCase();
    for (const line of splitPlanLines(s.text).items) {
      const words = line.toLowerCase().split(/\s+/).slice(0, 4).join(" ");
      assert.ok(!decoded.includes(words), `the link leaks "${words}"`);
    }
    assert.ok(href.length < 60, "the link is short: no text in it");
  }
});

test("a sample id is encoded, so it can't add parameters of its own", () => {
  const url = new URL(sampleCheckHref("a&text=secret"), "http://x");
  assert.equal(url.searchParams.get("text"), null);
  assert.equal(url.searchParams.get("sample"), "a&text=secret");
});
