"use client";

import { useEffect, useRef } from "react";
import { motionPaused, onMotionChange, prefersReducedMotion } from "./motion";

export interface HeroMedia {
  mp4: string;
  webm: string;
  portrait: string;
  poster: string;
  portraitPoster: string;
}

// Full-bleed looped background behind the hero. It plays only while on screen, in a visible tab,
// with motion allowed; under reduced motion the poster frame is all that shows.
export function HeroBackdrop({ media }: { media: HeroMedia }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = true;
    const portrait = window.matchMedia("(orientation: portrait)");
    if (portrait.matches) video.poster = media.portraitPoster;
    let visible = true;
    const sync = () => {
      const play = visible && !document.hidden && !motionPaused() && !prefersReducedMotion();
      if (play) video.play().catch(() => {});
      else video.pause();
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      sync();
    });
    io.observe(video);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    document.addEventListener("visibilitychange", sync);
    mq.addEventListener("change", sync);
    const off = onMotionChange(sync);
    sync();
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      mq.removeEventListener("change", sync);
      off();
    };
  }, [media.portraitPoster]);

  return (
    <div
      className="lp-film"
      aria-hidden="true"
      style={{ "--poster": `url(${media.poster})`, "--poster-p": `url(${media.portraitPoster})` } as React.CSSProperties}
    >
      <video ref={ref} className="lp-film-media" muted loop playsInline autoPlay preload="metadata" poster={media.poster}>
        <source media="(orientation: portrait)" src={media.portrait} type="video/mp4" />
        <source src={media.webm} type="video/webm" />
        <source src={media.mp4} type="video/mp4" />
      </video>
      <div className="lp-film-shade" />
    </div>
  );
}
