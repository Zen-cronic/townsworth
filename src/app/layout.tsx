import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import "./landing.css";
import "./charts.css";
import "./marks.css";
import "./motion.css";
import "./compose.css";
import "./colour.css";
import { SiteFooter } from "@/components/landing/SiteFooter";

// Archivo with its width axis: the wide cut sets display sizes, the normal width sets text.
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });

export const metadata: Metadata = {
  title: "Good Neighbor: community programs a town recognizes as its own",
  description:
    "Checks a data center's or plant's community-benefits plan line by line against the host town's own places, using Qloo's local taste data, and returns a costed, resident-ranked program.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={archivo.variable}>
      <body className="gn-landing antialiased">
        {/* Recolours the hero site plan: the light linework keeps its shape in the band's paint
            colour (set in CSS), and the dark ground drops out. */}
        <svg aria-hidden="true" width="0" height="0" focusable="false" style={{ position: "absolute" }}>
          <filter id="gn-paint-lines" colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.468 1.573 0.159 0 -0.4" result="lines" />
            <feFlood className="gn-paint-flood" result="paint" />
            <feComposite in="paint" in2="lines" operator="in" />
          </filter>
        </svg>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
