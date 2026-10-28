"use client";

import { useEffect, useState } from "react";
import { motionPaused, onMotionChange, setMotionPaused } from "./motion";

// A visible control for every looping animation on the page; the choice is remembered in this browser.
export function MotionToggle({ className = "" }: { className?: string }) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const initial = motionPaused();
    document.documentElement.dataset.motion = initial ? "paused" : "on";
    setPaused(initial);
    return onMotionChange(setPaused);
  }, []);

  return (
    <button type="button" className={`lp-motion ${className}`} aria-pressed={paused} onClick={() => setMotionPaused(!paused)}>
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
        {paused ? (
          <path d="M5 3.5v9l7-4.5z" fill="currentColor" />
        ) : (
          <path d="M5 3.5v9M11 3.5v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        )}
      </svg>
      {paused ? "Play motion" : "Pause motion"}
    </button>
  );
}
