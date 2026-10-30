// "Run a pilot" mailto link. A plain email link: nothing is stored or sent by the app.

import { PRODUCT_NAME } from "@/components/landing/brand";
import { Chevron } from "@/components/dashboard/Icons";

export const PILOT_EMAIL = "zin@kaungzinhein.com";

export function pilotHref(townName?: string): string {
  const subject = townName ? `${PRODUCT_NAME} pilot: ${townName}` : `${PRODUCT_NAME} pilot`;
  const body = [
    "Hi Kaung Zin,",
    "",
    `I work on community investment for a project${townName ? ` near ${townName}` : ""} and I'd like to talk about trying ${PRODUCT_NAME} on our plan.`,
    "",
    "Role / organisation:",
    "Project and town:",
    "",
  ].join("\n");
  return `mailto:${PILOT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function PilotLink({ townName, className = "", children }: { townName?: string; className?: string; children?: React.ReactNode }) {
  return (
    <a href={pilotHref(townName)} className={className}>
      {children ?? "Run a pilot in your town"}
      <Chevron className="ml-0.5 inline h-3 w-3 align-baseline" />
    </a>
  );
}
