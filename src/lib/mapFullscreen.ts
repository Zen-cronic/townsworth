// Keyboard rules for the town map's full screen view. Kept apart from the component so they can
// be tested without a browser.

export type FullMode = "native" | "overlay";

export interface KeyInfo {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  alt?: boolean;
  repeat?: boolean;
  /** The event target is a text field, a select or an editable region. */
  typing: boolean;
  /** Focus is inside the map section, or the pointer is over it. */
  engaged: boolean;
}

/** What a key press does to the full screen view: toggle it, exit it, or nothing. */
export function fullscreenKey(k: KeyInfo, mode: FullMode | null): "toggle" | "exit" | null {
  if (k.ctrl || k.meta || k.alt || k.repeat) return null;
  if (k.key === "Escape") return mode === "overlay" ? "exit" : null;
  if (k.key !== "f" && k.key !== "F") return null;
  if (k.typing) return null;
  return mode || k.engaged ? "toggle" : null;
}

const TEXT_INPUTS = new Set(["text", "search", "email", "url", "tel", "password", "number", "date", "datetime-local", "month", "time", "week"]);

/** Whether a key press on this element is someone typing. */
export function isTypingTarget(el: { tagName?: string; type?: string; isContentEditable?: boolean } | null | undefined): boolean {
  if (!el?.tagName) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName.toUpperCase();
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") return TEXT_INPUTS.has((el.type || "text").toLowerCase());
  return false;
}
