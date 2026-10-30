import assert from "node:assert/strict";
import { test } from "node:test";
import { memoSuccess } from "../src/lib/memo";

test("callers that arrive together share one lookup", async () => {
  let calls = 0;
  const get = memoSuccess(async (k) => (calls++, k.toUpperCase()), { ttlMs: 1000, max: 10 });
  const [a, b] = await Promise.all([get("x"), get("x")]);
  assert.equal(a, "X");
  assert.equal(b, "X");
  assert.equal(calls, 1);
  await get("x");
  assert.equal(calls, 1);
});

test("a failed lookup is never kept: the next caller asks again", async () => {
  let calls = 0;
  const get = memoSuccess(
    async () => {
      calls++;
      if (calls === 1) throw new Error("429");
      return "ok";
    },
    { ttlMs: 1000, max: 10 },
  );
  await assert.rejects(get("k"));
  assert.equal(await get("k"), "ok");
  assert.equal(calls, 2);
  assert.equal(await get("k"), "ok");
  assert.equal(calls, 2);
});

test("an answer expires after its time to live", async () => {
  let t = 0;
  let calls = 0;
  const get = memoSuccess(async () => ++calls, { ttlMs: 100, max: 10, now: () => t });
  assert.equal(await get("k"), 1);
  t = 99;
  assert.equal(await get("k"), 1);
  t = 100;
  assert.equal(await get("k"), 2);
});

test("past the cap the oldest answer is dropped", async () => {
  let calls = 0;
  const get = memoSuccess(async (k) => (calls++, k), { ttlMs: 1000, max: 2 });
  await get("a");
  await get("b");
  await get("c");
  assert.equal(calls, 3);
  await get("c");
  await get("b");
  assert.equal(calls, 3);
  await get("a");
  assert.equal(calls, 4);
});
