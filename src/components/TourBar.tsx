"use client";

import "./TourBar.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Chevron } from "@/components/landing/Chevron";
import { nextStop, tourStep, type TourStop } from "@/lib/tour";

const TOTAL = 5;
const AT_KEY = "tw-tour-at";
const STOPS_KEY = "tw-tour-stops";

function readStops(): TourStop[] | null {
  try {
    const raw = JSON.parse(sessionStorage.getItem(STOPS_KEY) ?? "null");
    return Array.isArray(raw) && raw.length === TOTAL && raw.every((s) => typeof s?.title === "string" && typeof s?.href === "string" && s.href.startsWith("/")) ? raw : null;
  } catch {
    return null;
  }
}

// On the tour page: remembers each step's title and page for the bar below.
export function TourStops({ stops }: { stops: TourStop[] }) {
  useEffect(() => {
    try {
      sessionStorage.setItem(STOPS_KEY, JSON.stringify(stops));
    } catch {}
  }, [stops]);
  return null;
}

// A bar at the foot of the screen on a page opened from the product tour (`?tour=N`): where you
// are in the tour, the way back to it, and the next step. It stays for the rest of the visit, so a
// click onward inside the step (a town from the search, the results of the ballot) keeps it, and
// it closes for good with Close. Pages opened any other way never show it.
export function TourBar() {
  const pathname = usePathname();
  const [state, setState] = useState<{ step: number; stops: TourStop[] | null } | null>(null);

  useEffect(() => {
    let step: number | null = null;
    try {
      step = tourStep(new URLSearchParams(location.search).get("tour"), TOTAL);
      if (step) sessionStorage.setItem(AT_KEY, String(step));
      else step = tourStep(sessionStorage.getItem(AT_KEY), TOTAL);
    } catch {}
    // The tour page itself needs no bar.
    setState(step && pathname !== "/judges" ? { step, stops: readStops() } : null);
  }, [pathname]);

  if (!state) return null;
  const { step, stops } = state;
  const here = stops?.[step - 1]?.title;
  const next = nextStop(step, stops, TOTAL);
  const close = () => {
    try {
      sessionStorage.removeItem(AT_KEY);
    } catch {}
    setState(null);
  };

  return (
    <>
      <div className="tour-spacer no-print" aria-hidden="true" />
      <nav className="tour-bar no-print" aria-label="Product tour">
        <p className="tour-at">
          <span className="tour-n">
            Step {step} of {TOTAL}
          </span>
          {here && <span className="tour-title">{here}</span>}
        </p>
        <div className="tour-actions">
          <Link href={`/judges#step-${step}`} className="tour-btn tour-back">
            Back to the tour
          </Link>
          <Link href={next.href} className="tour-btn tour-next">
            <span className="tour-next-k">{step >= TOTAL ? "Optional" : "Next"}</span>
            <span className="tour-next-l">{next.label}</span>
            <Chevron />
          </Link>
          <button type="button" onClick={close} className="tour-close" aria-label="Close the tour bar">
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      </nav>
    </>
  );
}
