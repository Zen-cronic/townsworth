"use client";

import { useEffect, useRef, useState } from "react";

// A submit button for a plain GET form: it says it's working from the moment the form submits
// until the next page replaces this one. The form still works without JavaScript.
export function PendingSubmit({ children, pendingLabel, className = "" }: { children: React.ReactNode; pendingLabel: string; className?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const start = () => setPending(true);
    // Coming back with the browser's Back button restores the page as it was left.
    const reset = () => setPending(false);
    form.addEventListener("submit", start);
    window.addEventListener("pageshow", reset);
    return () => {
      form.removeEventListener("submit", start);
      window.removeEventListener("pageshow", reset);
    };
  }, []);
  return (
    <button ref={ref} aria-busy={pending || undefined} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}
