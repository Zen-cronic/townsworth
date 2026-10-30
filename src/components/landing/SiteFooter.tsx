import Link from "next/link";
import { HERO_TOWN } from "@/lib/towns";
import { PilotLink } from "@/components/PilotLink";
import { PRODUCT_NAME } from "./brand";
import { BrandMark } from "./BrandMark";

const REPO = "https://github.com/Zen-cronic/good-neighbor";

const COLUMNS: { title: string; links: { href: string; label: string; external?: boolean }[] }[] = [
  {
    title: "Product",
    links: [
      { href: `/town/${HERO_TOWN.slug}`, label: `${HERO_TOWN.name} audit` },
      { href: `/memo/${HERO_TOWN.slug}`, label: "Committee memo" },
      { href: `/ballot/${HERO_TOWN.slug}`, label: "Resident ballot" },
      { href: "/find", label: "Any host town" },
    ],
  },
  {
    title: "Evidence",
    links: [
      { href: "/judges", label: "Guided path" },
      { href: "/proof", label: "Proof and its limits" },
      { href: "/sources", label: "Sources" },
    ],
  },
  {
    title: "Project",
    links: [
      { href: REPO, label: "Source code (MIT)", external: true },
      { href: `${REPO}/issues`, label: "Questions and pilots", external: true },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="lp-footer no-print">
      <div className="lp-wrap lp-footer-grid">
        <div className="lp-footer-brand">
          <span className="lp-brand">
            <BrandMark size={18} /> {PRODUCT_NAME}
          </span>
          <p>Community programs a host town recognizes as its own, checked line by line and costed from the fund.</p>
          <PilotLink className="lp-textlink lp-footer-pilot" />
          <p className="lp-footer-note">
            Qloo taste data is aggregate for a town, never about a person. Costs come from a per-session model and your fund, not from Qloo.
          </p>
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title} className="lp-footer-col">
            <p className="lp-footer-h">{c.title}</p>
            <ul>
              {c.links.map((l) => (
                <li key={l.href}>
                  {l.external ? (
                    <a href={l.href} target="_blank" rel="noopener noreferrer">
                      {l.label}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : (
                    <Link href={l.href}>{l.label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="lp-wrap">
        <div className="lp-footer-legal">
          <span>
            © {new Date().getFullYear()} {PRODUCT_NAME} · MIT licence
          </span>
          <span>Fund figures are illustrative unless a public figure exists. The resident tally is simulated.</span>
        </div>
      </div>
    </footer>
  );
}
