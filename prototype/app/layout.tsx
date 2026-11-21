import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Gelasio, Gloock, Instrument_Sans, Instrument_Serif, Pixelify_Sans, Playpen_Sans, Syne, Unbounded } from "next/font/google";
import "./globals.css";

// Polices choisies sur Fontesk, toutes sous licence SIL OFL (usage commercial permis). Hébergées avec le site, aucun appel à Google.
const sans = Instrument_Sans({ subsets: ["latin"], axes: ["wdth"], variable: "--font-instrument-sans" });
const f1 = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-c1" });
const f2 = Pixelify_Sans({ subsets: ["latin"], variable: "--font-c2" });
const f3 = Playpen_Sans({ subsets: ["latin"], variable: "--font-c3" });
const f4 = Unbounded({ subsets: ["latin"], variable: "--font-c4" });
const f5 = Gloock({ subsets: ["latin"], weight: "400", variable: "--font-c5" });
const f6 = Syne({ subsets: ["latin"], variable: "--font-c6" });
// Titre du héros : Georgia là où l'appareil l'a (Windows, Mac, iPhone) ; sinon Gelasio, dessinée aux mêmes mesures.
const gelasio = Gelasio({ subsets: ["latin"], weight: "400", variable: "--font-gelasio" });

export const metadata: Metadata = {
  title: "Renzvi — tes outils, au même endroit",
  description: "Réunis tâches, notes, minuteur et musique sur un dashboard que tu composes comme un moodboard.",
  robots: { index: false }, // à retirer au lancement
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};
export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={[sans, f1, f2, f3, f4, f5, f6, gelasio].map((f) => f.variable).join(" ")}>
      <body>
        <link rel="stylesheet" href="/dash/language.css" />
        {children}
        <Script src="/dash/language.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
