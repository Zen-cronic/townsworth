import assert from "node:assert/strict";
import { test } from "node:test";
import { splitSafe } from "../src/lib/filters";
import { entity } from "./fixtures";

test("splitSafe removes political and religious items and keeps the rest", () => {
  const church = entity("r1", "First Baptist Church", { cats: ["Church"] });
  const worship = entity("r2", "Lakeview Fellowship", { cats: ["Place of worship"] });
  const party = entity("x1", "County Republican Party Office", {});
  const pod = entity("x2", "Morning Politics Hour", { type: "podcast", tags: [{ name: "Politics", type: "urn:tag:genre:podcast" }] });
  const faithPod = entity("r3", "Sunday Hour", { type: "podcast", tags: [{ name: "Christian", type: "urn:tag:genre:podcast" }] });
  const brewery = entity("k1", "Harbor Brewing", { cats: ["Brewery"] });
  const inclusive = entity("k2", "Main Street Cafe", {
    cats: ["Cafe"],
    tags: [{ name: "Cafe", type: "urn:tag:category:place" }, { name: "LGBTQ+ friendly", type: "urn:tag:inclusivity:place" }],
  });
  const { kept, excluded } = splitSafe([church, worship, party, pod, faithPod, brewery, inclusive]);
  assert.deepEqual(kept.map((e) => e.id), ["k1", "k2"]);
  const reason = Object.fromEntries(excluded.map((x) => [x.entity.id, x.reason]));
  assert.deepEqual(reason, { r1: "religious", r2: "religious", x1: "political", x2: "political", r3: "religious" });
});

test("closed places are excluded too", () => {
  const { kept, excluded } = splitSafe([entity("c1", "Old Mill Diner", { cats: ["Diner"], isClosed: true })]);
  assert.equal(kept.length, 0);
  assert.equal(excluded[0].reason, "closed");
});
