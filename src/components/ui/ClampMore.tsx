"use client";

import { useEffect, useRef, useState } from "react";

// The "more" cue after a line-clamped element. It shows only while the previous sibling is
// actually truncated (scrollHeight > clientHeight), rechecked whenever that element resizes.
export function ClampMore({ className = "", label = "more" }: { className?: string; label?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [cut, setCut] = useState(false);
  useEffect(() => {
    const target = ref.current?.previousElementSibling as HTMLElement | null;
    if (!target) return;
    const check = () => setCut(target.scrollHeight - target.clientHeight > 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(target);
    return () => ro.disconnect();
  }, []);
  return (
    <span ref={ref} hidden={!cut} className={className}>
      {label}
    </span>
  );
}
