import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { clientIp, resetLimits, takeSlot } from "../src/lib/rateLimit";

beforeEach(resetLimits);

test("five requests per IP per ten minutes, then a friendly error", () => {
  const t = Date.UTC(2026, 9, 28, 12);
  for (let i = 0; i < 5; i++) assert.equal(takeSlot("agent", "1.2.3.4", t + i).ok, true);
  const sixth = takeSlot("agent", "1.2.3.4", t + 5);
  assert.equal(sixth.ok, false);
  assert.match(!sixth.ok ? sixth.error : "", /Too many/);
  assert.equal(takeSlot("agent", "5.6.7.8", t + 6).ok, true);
  assert.equal(takeSlot("live-draft", "1.2.3.4", t + 7).ok, true);
  assert.equal(takeSlot("agent", "1.2.3.4", t + 10 * 60 * 1000 + 1).ok, true);
});

test("the daily cap applies across IPs", () => {
  const t = Date.UTC(2026, 9, 28, 1);
  for (let i = 0; i < 300; i++) assert.equal(takeSlot("agent", `10.0.${Math.floor(i / 5)}.${i % 5}`, t).ok, true);
  assert.equal(takeSlot("agent", "9.9.9.9", t).ok, false);
  assert.equal(takeSlot("agent", "9.9.9.9", t + 24 * 60 * 60 * 1000).ok, true);
});

test("the client IP comes from x-real-ip, then the first x-forwarded-for hop", () => {
  assert.equal(clientIp(new Headers({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" })), "1.1.1.1");
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "2.2.2.2, 3.3.3.3" })), "2.2.2.2");
  assert.equal(clientIp(new Headers()), "unknown");
});
