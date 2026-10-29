import type { Metadata } from "next";
import { IBM_Plex_Mono, Public_Sans } from "next/font/google";
import "./globals.css";
import "./landing.css";
import { SiteFooter } from "@/components/landing/SiteFooter";

const publicSans = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Good Neighbor: community programs a town recognizes as its own",
  description:
    "Checks a data center's or plant's community-benefits plan line by line against the host town's own places, using Qloo's local taste data, and returns a costed, resident-ranked program.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${publicSans.variable} ${plexMono.variable} gn-landing antialiased`}>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
