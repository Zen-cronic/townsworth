"use client";

import { useEffect, useRef } from "react";

// Marks the in-page link whose section is being read: every `a[href^="#"]` inside the parent
// element gets `aria-current` while its target section sits under the sticky header. Rendered as an
// empty span inside a server-rendered nav, so the links themselves stay plain anchors.
export function SpyLinks({ current = "true" }: { current?: "true" | "step" | "location" }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const nav = ref.current?.parentElement;
    if (!nav) return;
    const links = [...nav.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
    const targets = links.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1)))).filter((el): el is HTMLElement => !!el);
    if (!targets.length) return;

    const mark = () => {
      // The section whose top has passed a line a third of the way down the viewport.
      const line = window.innerHeight / 3;
      let active = targets[0];
      for (const t of targets) if (t.getBoundingClientRect().top <= line) active = t;
      // Past the last section's end, nothing is current.
      const last = targets[targets.length - 1];
      const done = last.getBoundingClientRect().bottom < 0;
      for (const a of links) {
        const on = !done && a.hash === `#${active.id}`;
        if (on) a.setAttribute("aria-current", current);
        else a.removeAttribute("aria-current");
      }
    };

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(mark);
    };
    mark();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [current]);
  return <span ref={ref} hidden />;
}
