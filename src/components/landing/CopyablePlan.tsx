"use client";

import { useRef, useState } from "react";

// A plan shown as plain text with a Copy button. Where the clipboard API is unavailable or refused,
// the text is selected instead so the visitor can copy it by hand.
export function CopyablePlan({ text, label }: { text: string; label: string }) {
  const pre = useRef<HTMLPreElement>(null);
  const [said, setSaid] = useState("");

  function select() {
    const el = pre.current;
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (!el || !sel) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  async function copy() {
    setSaid("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
      await navigator.clipboard.writeText(text);
      setSaid("Copied");
    } catch {
      select();
      setSaid("Selected: press Ctrl+C or ⌘C to copy");
    }
  }

  return (
    <div className="grid gap-2">
      <pre
        ref={pre}
        aria-label={label}
        tabIndex={0}
        className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-rule bg-paper px-3 py-2.5 font-mono text-[13px] leading-relaxed text-ink"
      >
        {text}
      </pre>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void copy()} className="lp-btn lp-btn-quiet">
          Copy
        </button>
        <span aria-live="polite" role="status" className="text-xs text-muted">
          {said}
        </span>
      </div>
    </div>
  );
}
