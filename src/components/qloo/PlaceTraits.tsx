import type { QlooCall } from "@/lib/qloo";
import { traitLine, type AreaTag, type SharedTrait } from "@/lib/qlooInsights";

// The place traits Qloo finds this area over-indexes on (urn:tag at the site), identity tags removed.

// One "Why" line on a partner: the area traits the place carries, or nothing when it carries none.
export function TraitLine({ traits, className = "" }: { traits?: SharedTrait[]; className?: string }) {
  const line = traitLine(traits);
  if (!line) return null;
  return (
    <p data-trait-line className={className}>
      {line}
    </p>
  );
}

const SHOWN = 6;

// A row of the "What {town} favours" panel: the top traits as chips. When the call failed the row
// says so; when Qloo answered with no usable traits it isn't shown.
export function PlaceTraits({ tags, calls }: { tags?: AreaTag[]; calls?: Pick<QlooCall, "ok">[] }) {
  const failed = !!calls?.length && calls.some((c) => !c.ok);
  if (!tags?.length && !failed) return null;
  return (
    <div data-place-traits className="is-local">
      <dt>Place traits</dt>
      <dd>
        {tags?.length ? (
          <>
            {tags.slice(0, SHOWN).map((t) => (
              <span key={t.id} className="taste-chip">
                {t.name}
              </span>
            ))}
            <span className="taste-flag">top {Math.min(SHOWN, tags.length)} of {tags.length} this area over-indexes on</span>
          </>
        ) : (
          <span className="taste-flag">Qloo didn&apos;t answer, so these couldn&apos;t be checked</span>
        )}
      </dd>
    </div>
  );
}
