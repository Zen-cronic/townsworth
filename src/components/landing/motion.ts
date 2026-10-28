// One site-wide "pause motion" preference, shared by the hero loop and the scripted replay.
// Stored in this browser only.
const KEY = "gn-motion";
const EVENT = "gn-motion-change";

export function motionPaused(): boolean {
  const set = document.documentElement.dataset.motion;
  if (set) return set === "paused";
  try {
    return window.localStorage.getItem(KEY) === "paused";
  } catch {
    return false;
  }
}

export function setMotionPaused(paused: boolean) {
  try {
    if (paused) window.localStorage.setItem(KEY, "paused");
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage can be unavailable (private windows); the toggle still works for this page view.
  }
  document.documentElement.dataset.motion = paused ? "paused" : "on";
  window.dispatchEvent(new CustomEvent(EVENT, { detail: paused }));
}

export function onMotionChange(cb: (paused: boolean) => void) {
  const handler = (e: Event) => cb((e as CustomEvent<boolean>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
