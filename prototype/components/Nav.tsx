"use client";
import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Logo } from "./Bits";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/** Barre simple et blanche (blanc premium, 17 nov.) : logo, sections, connexion, un appel bleu. Marque la section en cours. */
export default function Nav({ links, login }: { links: string[][]; login: string }) {
  const bar = useRef<HTMLElement>(null);
  const [active, setActive] = useState("");

  useGSAP(() => {
    // Dès qu'on défile, un filet fin sépare la barre du contenu.
    ScrollTrigger.create({ start: 8, end: "max", onToggle: (t) => bar.current?.classList.toggle("nav-scrolled", t.isActive) });
    // Section en cours : celle qui traverse le milieu de l'écran.
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => setActive((now) => (e.isIntersecting ? `#${e.target.id}` : now === `#${e.target.id}` ? "" : now))),
      { rootMargin: "-50% 0px -50% 0px" }
    );
    links.forEach(([href]) => { const el = document.querySelector(href); if (el) io.observe(el); });
    return () => io.disconnect();
  });

  return (
    <header ref={bar} className="nav fixed inset-x-0 top-0 z-40 bg-white">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-2 px-[var(--m)]">
        <a href="#top" aria-label="Renzvi, haut de page" className="flex min-h-11 items-center gap-2.5 pr-4 font-semibold text-ink">
          <Logo className="size-6" />Renzvi
        </a>
        <nav aria-label="Sections de la page" className="hidden gap-1 lg:flex">
          {links.map(([href, label]) => (
            <a key={href} href={href} aria-current={active === href ? "true" : undefined}
              className={`flex h-9 items-center rounded-[10px] px-3.5 font-medium transition-colors ${active === href ? "text-accent" : "text-soft hover:bg-lin hover:text-ink"}`}>{label}</a>
          ))}
        </nav>
        <a href={login} className="ml-auto hidden h-10 items-center rounded-[10px] px-3 font-medium text-soft transition-colors hover:text-ink sm:flex">Connexion</a>
        <a href={login} className="group ml-auto flex h-10 items-center gap-2 whitespace-nowrap rounded-full bg-accent px-4 font-semibold text-white transition-colors hover:bg-accent-deep focus-visible:outline-accent sm:ml-0">
          Créer mon espace
          <svg viewBox="0 0 24 24" aria-hidden="true" className="hidden size-4 transition-transform group-hover:translate-x-0.5 min-[360px]:block"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </a>
      </div>
    </header>
  );
}
