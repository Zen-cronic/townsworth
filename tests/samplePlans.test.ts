import assert from "node:assert/strict";
import { test } from "node:test";
import { HERO_SAMPLE_ID, sampleCheckHref, samplePlanById, samplePlanForTown, SAMPLE_PLANS, sampleTown } from "../src/lib/samplePlans";
import { groundModelItems, MAX_CHARS, MAX_ITEMS, MIN_CHARS, SAMPLE_PLAN, SHORT_INPUT, splitPlanLines, validateCheckInput } from "../src/lib/userPlanParse";
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

test("every sample fits the parser's bounds; a town-specific sample names a preset town", () => {
  for (const s of SAMPLE_PLANS) {
    assert.ok(s.text.trim().length >= MIN_CHARS, `${s.id} is too short`);
    assert.ok(s.text.length <= MAX_CHARS, `${s.id} is too long`);
    assert.ok(s.label.length > 0);
    if (s.town) {
      const town = townBySlug(s.town);
      assert.ok(town && !town.custom, `${s.id} has no preset town`);
    }
    const check = validateCheckInput({ town: s.town ?? "mount-pleasant-wi", text: s.text });
    assert.equal(check.ok, true, s.id);
    const { items, truncated } = splitPlanLines(s.text);
    assert.equal(truncated, false);
    assert.ok(items.length >= 5 && items.length <= MAX_ITEMS, `${s.id} splits into ${items.length} items`);
  }
});

test("the hero sample has ten commitments under its heading, by either split", () => {
  const s = samplePlanById(HERO_SAMPLE_ID)!;
  const { items } = splitPlanLines(s.text);
  assert.equal(items.length, 10);
  assert.ok(!items.some((i) => /\(draft\)$/.test(i)), "the heading is not an item");
  // Over SHORT_INPUT, production asks the model to split it, copying each commitment verbatim. A
  // verbatim split of the ten lines, with the partners it names, must survive grounding intact.
  assert.ok(s.text.trim().length >= SHORT_INPUT);
  const partners: Record<number, string> = { 0: "Gateway Technical College", 1: "Racine County Economic Development Corporation", 4: "Racine Art Museum", 5: "Joy House" };
  const grounded = groundModelItems(s.text, items.map((item, i) => ({ item: item.replace(/^\d+\.\s*/, ""), partner: partners[i] ?? null })));
  assert.equal(grounded.length, 10);
  assert.deepEqual(grounded.flatMap((g) => (g.named ? [g.named] : [])), Object.values(partners));
});

test("a town-specific sample is only ever checked against its own town", () => {
  const mp = samplePlanById(HERO_SAMPLE_ID)!;
  assert.equal(sampleTown(mp, "clay-ny"), "mount-pleasant-wi");
  assert.equal(sampleTown(mp, undefined), "mount-pleasant-wi");
  const generic = samplePlanById("generic")!;
  assert.equal(generic.town, undefined);
  assert.equal(sampleTown(generic, "clay-ny"), "clay-ny");
  assert.equal(sampleTown(undefined, "clay-ny"), "clay-ny");
  assert.equal(samplePlanForTown("mount-pleasant-wi"), mp);
  assert.equal(samplePlanForTown("kemmerer-wy"), generic);
});

test("the /check link carries the sample id and never the plan text", () => {
  for (const s of SAMPLE_PLANS) {
    const href = sampleCheckHref(s.id);
    assert.equal(href, `/check?sample=${s.id}`);
  }
});

test("a sample id is encoded, so it can't add parameters of its own", () => {
  const url = new URL(sampleCheckHref("a&text=secret"), "http://x");
  assert.equal(url.searchParams.get("text"), null);
  assert.equal(url.searchParams.get("sample"), "a&text=secret");
});
