import Link from "next/link";
import { HERO_TOWN } from "@/lib/towns";
import { PilotLink } from "@/components/PilotLink";
import { PRODUCT_NAME } from "./brand";
import { BrandMark } from "./BrandMark";

const REPO = "https://github.com/Zen-cronic/townsworth";

const COLUMNS: { title: string; links: { href: string; label: string; external?: boolean }[] }[] = [
  {
    title: "Product",
    links: [
      { href: `/town/${HERO_TOWN.slug}`, label: "Example report" },
      { href: `/memo/${HERO_TOWN.slug}`, label: "Committee memo" },
      { href: `/ballot/${HERO_TOWN.slug}`, label: "Resident ballot" },
      { href: "/find", label: "Find a town" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/judges", label: "Product tour" },
      { href: "/proof", label: "Methodology" },
      { href: "/sources", label: "Sources" },
    ],
  },
  {
    title: "About",
    links: [
      { href: REPO, label: "GitHub", external: true },
      { href: `${REPO}/issues`, label: "Contact", external: true },
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
          <p>Checks a facility&apos;s community-benefits plan against the host town, line by line, and costs each item.</p>
          <PilotLink className="lp-btn lp-btn-quiet lp-btn-sm lp-footer-pilot">Request a pilot</PilotLink>
          <p className="lp-footer-note">
            Privacy: Qloo data is aggregate per town, never about a person.
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
        </div>
      </div>
    </footer>
  );
}
