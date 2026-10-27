"use client";

import { Printer } from "./Icons";

export function PrintButton({ className = "" }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      <Printer />
      Print or save PDF
    </button>
  );
}
