import type { Metadata } from "next";
import { Archivo, Courier_Prime, IBM_Plex_Mono, Libre_Franklin, Overpass, Overpass_Mono, Public_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import "./landing.css";
import "./charts.css";
import "./themes.css";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { THEME_SCRIPT } from "@/components/theme";

const publicSans = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });

// Type for the three switchable themes (?theme=locate | guide | packet). Not preloaded: a page
// fetches only the faces its active theme uses.
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"], preload: false });
const overpass = Overpass({ variable: "--font-overpass", subsets: ["latin"], preload: false });
const overpassMono = Overpass_Mono({ variable: "--font-overpass-mono", subsets: ["latin"], preload: false });
const libreFranklin = Libre_Franklin({ variable: "--font-libre-franklin", subsets: ["latin"], preload: false });
const sourceSerif = Source_Serif_4({ variable: "--font-source-serif", subsets: ["latin"], preload: false });
const courierPrime = Courier_Prime({ variable: "--font-courier-prime", subsets: ["latin"], weight: ["400", "700"], preload: false });

const FONT_VARS = [publicSans, plexMono, archivo, overpass, overpassMono, libreFranklin, sourceSerif, courierPrime]
  .map((f) => f.variable)
  .join(" ");

export const metadata: Metadata = {
  title: "Good Neighbor: community programs a town recognizes as its own",
  description:
    "Checks a data center's or plant's community-benefits plan line by line against the host town's own places, using Qloo's local taste data, and returns a costed, resident-ranked program.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // The theme script sets data-theme on <html> before first paint, so that attribute differs from the server markup.
    <html lang="en" className={FONT_VARS} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="gn-landing antialiased">
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
