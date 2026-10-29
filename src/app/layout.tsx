import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import "./landing.css";
import "./charts.css";
import "./marks.css";
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
        {/* Recolours the hero site plan as green locate paint: light linework stays, the dark ground drops out. */}
        <svg aria-hidden="true" width="0" height="0" focusable="false" style={{ position: "absolute" }}>
          <filter id="gn-paint-lines" colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values="0 0 0 0 0.643  0 0 0 0 0.863  0 0 0 0 0.388  0.468 1.573 0.159 0 -0.4" />
          </filter>
        </svg>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
