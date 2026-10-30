"use client";

import { useEffect } from "react";

// Scrolls a horizontally overflowing nav so its current item (aria-current) sits in view, on
// load only; the page itself never scrolls.
export function CenterCurrent({ navLabel }: { navLabel: string }) {
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>(`nav[aria-label="${navLabel}"]`);
    const on = nav?.querySelector<HTMLElement>('[aria-current="page"], [aria-current="true"]');
    if (!nav || !on || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollLeft = Math.max(0, on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2);
  }, [navLabel]);
  return null;
}
