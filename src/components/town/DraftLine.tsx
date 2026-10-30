"use client";

import { useEffect, useRef, useState } from "react";

// One audited draft line. The text is plain content (not a button), clamped to two lines; a
// "Show full line" button appears only when the clamp actually cuts text. The audit's
// "Show all lines in full" switch lifts every clamp at once through the list's data-full attribute.
export function DraftLine({ text, struck, line }: { text: string; struck: boolean; line: number }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [cut, setCut] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setCut(el.scrollHeight - el.clientHeight > 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  return (
    <div>
      <p
        ref={ref}
        className={`text-[15px] leading-relaxed ${open ? "" : "line-clamp-2 group-data-[full]/audit:line-clamp-none"} ${struck ? "text-muted" : "text-ink"}`}
      >
        <span className={struck ? "strike" : ""}>{text}</span>
      </p>
      {(cut || open) && (
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${open ? "Show less of" : "Show full"} line ${line}`}
          onClick={() => setOpen((o) => !o)}
          className="no-print mt-0.5 text-xs text-muted underline decoration-rule underline-offset-2 hover:text-ink hover:decoration-ink group-data-[full]/audit:hidden"
        >
          {open ? "Show less" : "Show full line"}
        </button>
      )}
    </div>
  );
}
