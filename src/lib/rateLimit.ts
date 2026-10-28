import "server-only";

// In-memory limits for the routes that call OpenAI. State is per server instance and resets on a
// cold start, so this is a cost guard, not an exact quota. Each bucket (agent drafts, live plan
// drafts) has its own per-IP window; the daily cap is shared by every bucket.

const WINDOW_MS = 10 * 60 * 1000;
const PER_IP = 5;
const DAILY_CAP = 300;
const MAX_TRACKED = 5000;

const hits = new Map<string, number[]>();
let day = "";
let dayCount = 0;

export function clientIp(h: Headers): string {
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

export type SlotResult = { ok: true } | { ok: false; error: string };

export function takeSlot(bucket: string, ip: string, now = Date.now()): SlotResult {
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    dayCount = 0;
  }
  if (dayCount >= DAILY_CAP) {
    return { ok: false, error: "The daily limit for AI drafts is used up. Try again tomorrow; the program and exports still work." };
  }
  const key = `${bucket}|${ip}`;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= PER_IP) {
    hits.set(key, recent);
    const wait = Math.max(1, Math.ceil((WINDOW_MS - (now - recent[0])) / 60000));
    return { ok: false, error: `Too many AI drafts from your network. Try again in about ${wait} min; the program and exports still work.` };
  }
  recent.push(now);
  hits.set(key, recent);
  dayCount++;
  if (hits.size > MAX_TRACKED) {
    for (const [k, ts] of hits) if (!ts.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  }
  return { ok: true };
}

// Test hook: clears all counters.
export function resetLimits() {
  hits.clear();
  day = "";
  dayCount = 0;
}
