import type { Metadata, Viewport } from "next";
import { Gloock, Instrument_Sans, Instrument_Serif, Pixelify_Sans, Playpen_Sans, Syne, Unbounded } from "next/font/google";
import "./globals.css";

// Polices choisies sur Fontesk, toutes sous licence SIL OFL (usage commercial permis). Hébergées avec le site, aucun appel à Google.
const sans = Instrument_Sans({ subsets: ["latin"], axes: ["wdth"], variable: "--font-instrument-sans" });
const f1 = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-c1" });
const f2 = Pixelify_Sans({ subsets: ["latin"], variable: "--font-c2" });
const f3 = Playpen_Sans({ subsets: ["latin"], variable: "--font-c3" });
const f4 = Unbounded({ subsets: ["latin"], variable: "--font-c4" });
const f5 = Gloock({ subsets: ["latin"], weight: "400", variable: "--font-c5" });
const f6 = Syne({ subsets: ["latin"], variable: "--font-c6" });

export const metadata: Metadata = {
  title: "Renzvi — tes outils, au même endroit",
  description: "Réunis tâches, notes, minuteur et musique sur un dashboard que tu composes comme un moodboard.",
  robots: { index: false }, // à retirer au lancement
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};
export const viewport: Viewport = { themeColor: "#f6f5f4" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={[sans, f1, f2, f3, f4, f5, f6].map((f) => f.variable).join(" ")}>
      <body>{children}</body>
    </html>
  );
}
