import assert from "node:assert/strict";
import { test } from "node:test";
import { nextStop, tourStep, withTour } from "../src/lib/tour";

test("the tour step goes before the fragment and keeps other parameters", () => {
  assert.equal(withTour("/town/mount-pleasant-wi?plan=agency#line-1", 1), "/town/mount-pleasant-wi?plan=agency&tour=1#line-1");
  assert.equal(withTour("/memo/mount-pleasant-wi", 2), "/memo/mount-pleasant-wi?tour=2");
  assert.equal(withTour("/proof#limits", 5), "/proof?tour=5#limits");
  assert.equal(withTour("/find?q=Taylor%2C%20TX&facility=fab", 4), "/find?q=Taylor%2C+TX&facility=fab&tour=4");
  assert.equal(withTour("/proof?tour=2", 5), "/proof?tour=5");
});

test("only a step of this tour counts", () => {
  assert.equal(tourStep("3", 5), 3);
  assert.equal(tourStep("0", 5), null);
  assert.equal(tourStep("6", 5), null);
  assert.equal(tourStep("2x", 5), null);
  assert.equal(tourStep(null, 5), null);
});

test("next goes to the next stop's page, or to the tour when the stops are unknown", () => {
  const stops = [
    { title: "One", href: "/a" },
    { title: "Two", href: "/b#x" },
  ];
  assert.deepEqual(nextStop(1, stops, 2), { href: "/b?tour=2#x", label: "Two" });
  assert.deepEqual(nextStop(2, stops, 2), { href: "/judges#own-plan", label: "Check a plan of your own" });
  assert.deepEqual(nextStop(1, null, 5), { href: "/judges#step-2", label: "Step 2" });
});
