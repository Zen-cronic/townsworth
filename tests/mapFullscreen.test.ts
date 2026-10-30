import assert from "node:assert/strict";
import { test } from "node:test";
import { fullscreenKey, isTypingTarget } from "../src/lib/mapFullscreen";

const k = (key: string, over: Partial<Parameters<typeof fullscreenKey>[0]> = {}) => ({ key, typing: false, engaged: true, ...over });

test("F toggles full screen when the map is engaged, or while full screen is on", () => {
  assert.equal(fullscreenKey(k("f"), null), "toggle");
  assert.equal(fullscreenKey(k("F"), null), "toggle");
  assert.equal(fullscreenKey(k("f", { engaged: false }), null), null);
  assert.equal(fullscreenKey(k("f", { engaged: false }), "native"), "toggle");
  assert.equal(fullscreenKey(k("f", { engaged: false }), "overlay"), "toggle");
});

test("F does nothing while typing, with a modifier or on key repeat", () => {
  assert.equal(fullscreenKey(k("f", { typing: true }), "overlay"), null);
  assert.equal(fullscreenKey(k("f", { meta: true }), null), null);
  assert.equal(fullscreenKey(k("f", { ctrl: true }), "overlay"), null);
  assert.equal(fullscreenKey(k("f", { repeat: true }), "overlay"), null);
});

test("Esc exits the overlay; native full screen handles Esc itself", () => {
  assert.equal(fullscreenKey(k("Escape"), "overlay"), "exit");
  assert.equal(fullscreenKey(k("Escape", { typing: true }), "overlay"), "exit");
  assert.equal(fullscreenKey(k("Escape"), "native"), null);
  assert.equal(fullscreenKey(k("Escape"), null), null);
  assert.equal(fullscreenKey(k("g"), "overlay"), null);
});

test("text fields count as typing; buttons and checkboxes don't", () => {
  assert.equal(isTypingTarget({ tagName: "INPUT", type: "text" }), true);
  assert.equal(isTypingTarget({ tagName: "input", type: "" }), true);
  assert.equal(isTypingTarget({ tagName: "TEXTAREA" }), true);
  assert.equal(isTypingTarget({ tagName: "DIV", isContentEditable: true }), true);
  assert.equal(isTypingTarget({ tagName: "INPUT", type: "checkbox" }), false);
  assert.equal(isTypingTarget({ tagName: "BUTTON" }), false);
  assert.equal(isTypingTarget(null), false);
});
