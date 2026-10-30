import { AGE_BUCKETS, ageSkewLabel, type AgeProfile, type AgeBucket } from "@/lib/qlooInsights";

// A partner's audience age profile from Qloo, as one plain line: the age group the place's
// audience over-indexes on most, or that no group stands out. Aggregate affinity for the people
// who favour the place, never a visitor count. Renders nothing when Qloo has no profile.

const SHORT: Record<AgeBucket, string> = {
  "24_and_younger": "under 25",
  "25_to_29": "25–29",
  "30_to_34": "30–34",
  "35_to_44": "35–44",
  "45_to_54": "45–54",
  "55_and_older": "55+",
};

export function AgeStrip({ ages, className = "" }: { ages?: AgeProfile; className?: string }) {
  const label = ageSkewLabel(ages);
  if (!ages || !label) return null;
  const broad = label === "broad age mix";
  const top = AGE_BUCKETS.reduce((best, b) => (ages[b] > ages[best] ? b : best), AGE_BUCKETS[0]);
  return (
    <p data-age-strip className={`age-line ${className}`}>
      <span className="age-line-k">Qloo audience age:</span>{" "}
      {/* A non-breaking hyphen, so a narrow card never splits "over-indexes" across two lines. */}
      <b>{broad ? "broad mix, no group stands out" : `over‑indexes with ${SHORT[top]}`}</b>
    </p>
  );
}
