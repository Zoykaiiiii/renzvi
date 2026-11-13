"use client";
import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Logo } from "./Bits";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/** Barre flottante : se resserre et se soulève dès qu'on défile, et marque la section en cours. */
export default function Nav({ links, login }: { links: string[][]; login: string }) {
  const bar = useRef<HTMLElement>(null);
  const [active, setActive] = useState("");

  useGSAP(() => {
    const lift = gsap.to(bar.current, { y: -6, scale: 0.985, boxShadow: "0 18px 40px -18px rgba(0,0,0,.55)", duration: 0.35, ease: "power2.out", paused: true });
    ScrollTrigger.create({ start: 40, end: "max", onToggle: (t) => (t.isActive ? lift.play() : lift.reverse()) });
    // Section en cours : celle qui traverse le milieu de l'écran.
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => setActive((now) => (e.isIntersecting ? `#${e.target.id}` : now === `#${e.target.id}` ? "" : now))),
      { rootMargin: "-50% 0px -50% 0px" }
    );
    links.forEach(([href]) => { const el = document.querySelector(href); if (el) io.observe(el); });
    return () => io.disconnect();
  });

  return (
    <header ref={bar} className="fixed inset-x-[var(--m)] top-3 z-40 mx-auto flex h-14 max-w-[1100px] items-center gap-2 rounded-box bg-ink pl-3 pr-2 text-white ring-1 ring-white/10">
      <a href="#top" aria-label="Renzvi, haut de page" className="flex min-h-11 items-center gap-2.5 pr-4 font-semibold">
        <span className="grid size-8 place-items-center rounded-[10px] bg-white"><Logo className="size-5" /></span>Renzvi
      </a>
      <nav aria-label="Sections de la page" className="hidden gap-1 lg:flex">
        {links.map(([href, label]) => (
          <a key={href} href={href} aria-current={active === href ? "true" : undefined}
            className={`flex h-9 items-center rounded-[10px] px-4 font-medium transition-colors ${active === href ? "bg-white/15" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>{label}</a>
        ))}
      </nav>
      <a href={login} className="ml-auto hidden h-10 items-center rounded-[10px] px-3 font-medium text-white/75 hover:text-white sm:flex">Connexion</a>
      <a href={login} className="group ml-auto flex h-10 items-center gap-2 rounded-[10px] bg-white px-4 font-semibold text-ink transition-colors hover:bg-lin sm:ml-0">
        Créer mon espace
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </a>
    </header>
  );
}
