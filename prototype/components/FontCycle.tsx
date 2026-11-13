"use client";
import { useEffect, useState } from "react";

const FACES = [
  { name: "Instrument Serif", css: "var(--font-c1)", size: 1.18 },
  { name: "Pixelify Sans", css: "var(--font-c2)", size: 1 },
  { name: "Playpen Sans", css: "var(--font-c3)", size: 0.92 },
  { name: "Unbounded", css: "var(--font-c4)", size: 0.8 },
  { name: "Gloock", css: "var(--font-c5)", size: 1.05 },
  { name: "Syne", css: "var(--font-c6)", size: 1 },
];

/** La phrase change de police toute seule ; un clic sur un nom la fixe. */
export default function FontCycle({ children }: { children: string }) {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => !document.hidden && setI((n) => (n + 1) % FACES.length), 1600);
    return () => clearInterval(t);
  }, [auto]);
  const f = FACES[i];
  return (
    <div>
      <p className="flex h-[1.5em] items-center text-statement leading-none" style={{ fontFamily: f.css }}>
        <span key={i} className="font-swap" style={{ fontSize: `${f.size}em` }}>{children}</span>
      </p>
      <div role="group" aria-label="Choisir la police de la phrase" className="mt-3 flex flex-wrap gap-1.5">
        {FACES.map((face, n) => (
          <button key={face.name} type="button" aria-pressed={n === i} onClick={() => { setI(n); setAuto(false); }}
            className={`min-h-9 rounded-full px-3 text-small transition-colors ${n === i ? "bg-ink text-white" : "bg-lin hover:bg-sable"}`}>
            {face.name}
          </button>
        ))}
      </div>
    </div>
  );
}
