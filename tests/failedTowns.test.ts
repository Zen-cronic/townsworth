// Hand-written fixtures only; nothing here is Qloo API output.
import assert from "node:assert/strict";
import { test } from "node:test";
import { failedTownNames } from "../src/lib/proof";
import { listNames } from "../src/components/ui/labels";

const call = (ok: boolean) => ({ label: "places near point", params: {}, status: ok ? 200 : 503, ok, count: 0, ms: 1 });
const run = (name: string, failed: number) => ({ town: { name }, profile: { failedCalls: Array.from({ length: failed }, () => call(false)) } });

test("failedTownNames: lists only towns with a failed Qloo call, in town order", () => {
  const runs = [run("Mount Pleasant", 0), run("Clay", 2), null, run("Abilene", 1), run("Kemmerer", 0)];
  assert.deepEqual(failedTownNames(runs), ["Clay", "Abilene"]);
});

test("failedTownNames: empty when every call answered or there are no runs", () => {
  assert.deepEqual(failedTownNames([run("Mount Pleasant", 0), run("Clay", 0)]), []);
  assert.deepEqual(failedTownNames([]), []);
  assert.deepEqual(failedTownNames([null]), []);
});

test("listNames: reads as a sentence for one, two and more towns", () => {
  assert.equal(listNames([]), "");
  assert.equal(listNames(["Abilene"]), "Abilene");
  assert.equal(listNames(["Abilene", "Clay"]), "Abilene and Clay");
  assert.equal(listNames(["Abilene", "Clay", "Kemmerer"]), "Abilene, Clay and Kemmerer");
});
