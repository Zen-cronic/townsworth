import type { Metadata } from "next";
import { IBM_Plex_Mono, Public_Sans } from "next/font/google";
import "./globals.css";

const publicSans = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Good Neighbor: community programs a town recognizes as its own",
  description:
    "Red-pens a facility's generic community plan against what the host town actually over-indexes on, using Qloo, and returns a costed, resident-ranked program.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${publicSans.variable} ${plexMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
