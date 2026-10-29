import Link from "next/link";
import type { Town } from "@/lib/towns";
import { TownSearchForm } from "@/components/TownSearchForm";
import { Chevron } from "./Chevron";

export interface TownPick {
  pick?: { kind: string; partner: string; km?: number };
  signal?: { name: string; type: string };
}

const FACILITY: Record<Town["facility"], string> = {
  "data center": "Data center",
  fab: "Chip fab",
  nuclear: "Nuclear plant",
  plant: "Plant",
};

// Small line glyphs drawn for each facility type.
function FacilityGlyph({ type }: { type: Town["facility"] }) {
  const common = { viewBox: "0 0 24 24", width: 22, height: 22, "aria-hidden": true, focusable: false } as const;
  if (type === "nuclear") {
    return (
      <svg {...common} className="lp-glyph">
        <path d="M6 21c1.5-4 1.5-9 0-13h7c-1.5 4-1.5 9 0 13Z" />
        <path d="M15.5 21c1-3 1-6.5 0-9.5h4c-1 3-1 6.5 0 9.5Z" />
        <path d="M3 21h18" />
        <path d="M8 5.5c0-1 1-1.5 2-1.5s1.5-.8 2.5-.8" />
      </svg>
    );
  }
  if (type === "fab") {
    return (
      <svg {...common} className="lp-glyph">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M7.5 9.5h9M6.5 12h11M7.5 14.5h9M9.5 7v10M12 6.5v11M14.5 7v10" />
      </svg>
    );
  }
  return (
    <svg {...common} className="lp-glyph">
      <rect x="4" y="3.5" width="16" height="17" rx="1" />
      <path d="M4 9h16M4 14.5h16" />
      <path d="M7 6.25h3M7 11.75h3M7 17.25h3" />
    </svg>
  );
}

export function TownGrid({
  towns,
  partners,
  picks,
  heroSlug,
}: {
  towns: Town[];
  partners: Record<string, number>;
  picks: Record<string, TownPick>;
  heroSlug: string;
}) {
  return (
    <>
        <div className="lp-section-head">
          <h2 id="towns-h" className="lp-h2">
            Open any host town. The picks change because the town does.
          </h2>
          <p className="lp-section-lede">
            Every pick comes from that town’s own Qloo taste data.
          </p>
        </div>

        <ul className="lp-towns">
          {towns.map((t) => (
            <li key={t.slug}>
              <Link href={`/town/${t.slug}`} className="lp-town">
                <span className="lp-town-top">
                  <span className="lp-town-name">{t.name}</span>
                  {t.slug === heroSlug && <span className="lp-badge is-example">Example</span>}
                  {t.thinData && <span className="lp-badge is-thin">Thin data</span>}
                </span>
                <span className="lp-town-region">
                  <FacilityGlyph type={t.facility} />
                  {FACILITY[t.facility]} · {t.region}, {t.country === "United States" ? "US" : "Canada"}
                </span>
                {picks[t.slug]?.pick ? (
                  <span className="lp-town-pick">
                    <span className="lp-town-pick-k">
                      Top pick · {picks[t.slug].pick!.kind}
                      {picks[t.slug].pick!.km != null && ` · ${picks[t.slug].pick!.km} km`}
                    </span>
                    <span className="lp-town-pick-v">{picks[t.slug].pick!.partner}</span>
                  </span>
                ) : (
                  <span className="lp-town-pick is-empty">
                    <span className="lp-town-pick-k">Top pick</span>
                    <span className="lp-town-pick-v">Too few local places: enter partners from filings</span>
                  </span>
                )}
                {picks[t.slug]?.signal && (
                  <span className="lp-town-signal">
                    Local favourite: <b>{picks[t.slug].signal!.name}</b> ({picks[t.slug].signal!.type})
                  </span>
                )}
                <span className="lp-town-foot">
                  <span>
                    <b>{partners[t.slug] ?? 0}</b> local partners found
                  </span>
                  <Chevron />
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {/* Type any town */}
        <div className="lp-anytown">
          <div className="lp-anytown-copy">
            <h3 id="anytown-h" className="lp-h3">
              Or type any town
            </h3>
            <p>
              Any US or Canadian host town gets the same check, memo and exports.
            </p>
          </div>
          <TownSearchForm idPrefix="landing" />
        </div>
    </>
  );
}
