type Tone = "flag" | "ok" | "warn" | "neutral";

const TONE: Record<Tone, string> = {
  flag: "border-hivis/30 bg-hivis-wash text-hivis-text",
  ok: "border-ok/25 bg-ok-wash text-ok-text",
  warn: "border-amber/30 bg-amber-wash text-amber",
  neutral: "border-hairline bg-concrete text-muted",
};

const DOT: Record<Tone, string> = {
  flag: "bg-hivis",
  ok: "bg-ok",
  warn: "bg-amber",
  neutral: "bg-muted",
};

export function StatusPill({ tone, children, dot = true }: { tone: Tone; children: React.ReactNode; dot?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 ${TONE[tone]}`}
    >
      {dot && <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />}
      {children}
    </span>
  );
}
