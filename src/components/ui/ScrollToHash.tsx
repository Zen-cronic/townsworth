"use client";

import { useEffect } from "react";

// On a page that streams in behind a loading screen, the browser jumps to a #fragment before its
// section exists and stays at the top. Mounted with the content, this makes that jump once.
export function ScrollToHash() {
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    const el = id ? document.getElementById(id) : null;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.4) requestAnimationFrame(() => el.scrollIntoView({ block: "start" }));
  }, []);
  return null;
}
