"use client";

import { useEffect } from "react";
import { motionPaused, onMotionChange, prefersReducedMotion } from "./motion";

// One small island for the page's motion hooks; everything it touches is server-rendered and
// complete without it.
// - [data-replay]: the scripted replay loops only on screen, in a visible tab, with motion allowed.
// - [data-reveal]: a one-shot "open" class for browsers without scroll-driven animations.
// - [data-chapter]: chapter height as --h, so a tall chapter sticks by its bottom edge and the
//   next one slides over it.
export function LandingEffects() {
  useEffect(() => {
    const cleanups: (() => void)[] = [];
    const reduced = prefersReducedMotion();

    document.querySelectorAll<HTMLElement>("[data-replay]").forEach((el) => {
      let visible = false;
      const sync = () => {
        if (reduced || motionPaused()) el.dataset.play = "stopped";
        else el.dataset.play = visible && !document.hidden ? "on" : "off";
      };
      const io = new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        sync();
      });
      io.observe(el);
      document.addEventListener("visibilitychange", sync);
      const off = onMotionChange(sync);
      sync();
      cleanups.push(() => {
        io.disconnect();
        document.removeEventListener("visibilitychange", sync);
        off();
      });
    });

    if (!reduced && !CSS.supports("animation-timeline: view()")) {
      document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
        el.dataset.armed = "";
        const io = new IntersectionObserver(
          ([e]) => {
            if (!e.isIntersecting) return;
            el.dataset.open = "";
            io.disconnect();
          },
          { threshold: 0.35 },
        );
        io.observe(el);
        cleanups.push(() => io.disconnect());
      });
    }

    const chapters = document.querySelectorAll<HTMLElement>("[data-chapter]");
    if (chapters.length) {
      const ro = new ResizeObserver((entries) => {
        for (const e of entries) (e.target as HTMLElement).style.setProperty("--h", `${Math.ceil(e.target.getBoundingClientRect().height)}px`);
      });
      chapters.forEach((c) => ro.observe(c));
      cleanups.push(() => ro.disconnect());
    }

    return () => cleanups.forEach((c) => c());
  }, []);

  return null;
}
