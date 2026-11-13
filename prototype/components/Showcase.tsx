"use client";
import CardSwap, { Card } from "./CardSwap";
import OrbitImages from "./OrbitImages";
import { Logo, Slot } from "./Bits";

// Tuiles de l'orbite : le nom de vrais widgets, dessiné en SVG (pas de fichier image à charger).
const TOOLS: [string, string, string][] = [
  ["Tâches", "#242424", "#fff"], ["Notes", "#d9cdbd", "#242424"], ["Minuteur", "#fff", "#242424"], ["Playlist", "#615d59", "#fff"],
  ["Ambiance", "#eeeae4", "#242424"], ["Habitudes", "#242424", "#fff"], ["Cahier", "#d9cdbd", "#242424"], ["Flashcards", "#fff", "#242424"],
  ["Lecture", "#615d59", "#fff"], ["Respiration", "#eeeae4", "#242424"],
];
const tile = ([name, bg, ink]: [string, string, string]) => ({
  alt: name,
  src: `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="${bg}"/><text x="100" y="109" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="30" font-weight="600" fill="${ink}">${name}</text></svg>`
  )}`,
});

export function ToolsOrbit() {
  const images = TOOLS.map(tile);
  // Deux tailles : sur téléphone, une orbite plus serrée pour que les noms restent lisibles.
  return (
    <>
      <div className="hidden lg:block">
        <OrbitImages images={images} altPrefix="Widget" itemSize={132} itemRadius="30%" shadow={0} duration={46} radiusY={210}
          centerContent={<Logo className="w-36" />} />
      </div>
      <div className="lg:hidden">
        <OrbitImages images={images} altPrefix="Widget" baseWidth={560} radiusX={250} radiusY={190} itemSize={104} itemRadius="30%" shadow={0} duration={46}
          centerContent={<Logo className="w-20" />} />
      </div>
    </>
  );
}

const BOARDS: [string, "lin" | "sable" | "card" | "ink"][] = [
  ["dashboard Study", "card"], ["dashboard Chill", "sable"], ["dashboard avec ta photo en fond", "lin"], ["dashboard sombre", "ink"],
];

export function BoardSwap() {
  return (
    <CardSwap theme="dark" width={520} height={360} delay={3200} cardRadius={16}>
      {BOARDS.map(([label, tone]) => (
        <Card key={label}><Slot label={label} tone={tone} /></Card>
      ))}
    </CardSwap>
  );
}
