// Keeps the answers of an async lookup in this server instance, keyed by a string, and only the
// answers that succeeded: a rejection is dropped as soon as it settles, so the next caller asks
// again rather than inheriting the failure. Callers that arrive while a lookup is still in flight
// share it, so the same key is never asked twice at once. Entries expire after `ttlMs`, and the
// oldest are dropped past `max`. Callers must treat the value as read-only: it is shared.
export function memoSuccess<T>(
  fn: (key: string) => Promise<T>,
  { ttlMs, max, now = Date.now }: { ttlMs: number; max: number; now?: () => number },
): (key: string) => Promise<T> {
  const kept = new Map<string, { at: number; value: Promise<T> }>();
  return (key: string) => {
    const hit = kept.get(key);
    if (hit && now() - hit.at < ttlMs) return hit.value;
    if (hit) kept.delete(key);
    const value = fn(key);
    kept.set(key, { at: now(), value });
    value.catch(() => {
      if (kept.get(key)?.value === value) kept.delete(key);
    });
    while (kept.size > max) kept.delete(kept.keys().next().value as string);
    return value;
  };
}
