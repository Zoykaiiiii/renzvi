// Petites pièces partagées de la landing.

export function Logo({ light = false, className = "" }: { light?: boolean; className?: string }) {
  const c = light ? "#fff" : "#242424";
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <rect x="2" y="2" width="9" height="9" rx="3" fill={c} />
      <rect x="13" y="2" width="9" height="9" rx="3" fill={c} opacity={light ? 0.45 : 0.25} />
      <rect x="2" y="13" width="9" height="9" rx="3" fill={c} opacity={light ? 0.45 : 0.25} />
      <rect x="13" y="13" width="9" height="9" rx="3" fill={c} opacity={light ? 0.45 : 0.25} />
    </svg>
  );
}

/** Emplacement vide pour une illustration de dashboard (les images seront générées plus tard). */
export function Slot({ label, tone = "lin", className = "" }: { label: string; tone?: "lin" | "sable" | "card" | "ink"; className?: string }) {
  const bg = { lin: "bg-lin", sable: "bg-sable", card: "bg-card", ink: "bg-ink text-white" }[tone];
  return (
    <div data-slot={label} className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-box ${bg} ${className}`}>
      <Logo light={tone === "ink"} className="w-[22%] max-w-28 opacity-40" />
      <p className="absolute bottom-4 left-5 right-5 text-small">Illustration à venir : {label}</p>
    </div>
  );
}
