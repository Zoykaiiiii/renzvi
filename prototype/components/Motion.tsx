"use client";
import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(useGSAP, ScrollTrigger, ScrollSmoother, SplitText);

/** Tout le mouvement de la page, en GSAP : défilement lissé, héros épinglé, textes révélés, scène des modes. */
export default function Motion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    // Mouvement réduit : rien n'est lancé, la page reste entière et lisible telle quelle.
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // Lissage à la souris seulement : au doigt (dont TikTok/Instagram), le défilement natif reste.
      ScrollSmoother.create({ wrapper: root.current!, content: "#smooth-content", smooth: 1.1, effects: true });

      // Titres : ligne par ligne, depuis un masque.
      const splits = gsap.utils.toArray<HTMLElement>("[data-split]").map((el) =>
        SplitText.create(el, {
          type: "lines", mask: "lines", autoSplit: true,
          onSplit: (s) => gsap.from(s.lines, { yPercent: 110, duration: 0.9, ease: "power4.out", stagger: 0.09, scrollTrigger: { trigger: el, start: "top 88%", once: true } }),
        })
      );
      // Le reste de chaque section : monte, en décalé.
      ScrollTrigger.batch("[data-rise]", {
        start: "top 90%", once: true,
        onEnter: (els) => gsap.from(els, { y: 28, autoAlpha: 0, duration: 0.8, ease: "power3.out", stagger: 0.08 }),
      });

      // Héros : les trois carrés en attente du logo se remplissent, un outil chacun.
      const wait = gsap.utils.toArray<HTMLElement>("[data-sq='wait']");
      const fill = gsap.timeline({ defaults: { ease: "none" } });
      wait.forEach((sq) => {
        fill.fromTo(sq, { backgroundColor: "rgba(36,36,36,.22)", scale: 0.92 }, { backgroundColor: sq.dataset.bg!, scale: 1, immediateRender: true }, ">-0.15")
            .from(sq.children, { autoAlpha: 0, y: 24, stagger: 0.08, immediateRender: true }, "<0.2");
      });

      // Scène des modes : l'illustration reste, son état change avec la phrase active.
      const steps = gsap.utils.toArray<HTMLElement>("[data-step]");
      const states = gsap.utils.toArray<HTMLElement>("[data-state]");
      const show = (n: number) => {
        steps.forEach((s, i) => s.classList.toggle("text-soft", i !== n));
        gsap.to(states, { autoAlpha: (i) => (i === n ? 1 : 0), duration: 1.2, ease: "power2.inOut", overwrite: true });
      };
      gsap.set(states, { autoAlpha: (i) => (i === 0 ? 1 : 0) });
      steps.forEach((s, i) => ScrollTrigger.create({ trigger: s, start: "top 55%", end: "bottom 55%", onToggle: (t) => t.isActive && show(i) }));

      const sized = gsap.matchMedia();
      sized.add("(min-width: 1024px)", () => {
        ScrollTrigger.create({ animation: fill, trigger: "[data-hero]", start: "top top", end: "+=140%", pin: true, scrub: 0.6 });
        ScrollTrigger.create({ trigger: "[data-stage]", start: "top 96px", endTrigger: "[data-modes]", end: "bottom bottom", pin: true, pinSpacing: false });
        gsap.to("[data-drift]", { yPercent: -12, ease: "none", scrollTrigger: { trigger: "[data-drift]", scrub: true } });
      });
      sized.add("(max-width: 1023px)", () => {
        ScrollTrigger.create({ animation: fill, trigger: "[data-squares]", start: "top 75%", end: "bottom 60%", scrub: 0.6 });
        ScrollTrigger.create({ trigger: "[data-stage]", start: "top 64px", endTrigger: "[data-modes]", end: "bottom bottom", pin: true, pinSpacing: false });
      });
      // Les positions se recalculent dans l'ordre de la page, et à chaque fois que sa hauteur change (polices, cartes, orbite).
      ScrollTrigger.sort();
      let h = 0, t = 0;
      const ro = new ResizeObserver(() => {
        const now = document.documentElement.scrollHeight;
        if (now === h) return;
        h = now; clearTimeout(t); t = window.setTimeout(() => ScrollTrigger.refresh(), 200);
      });
      ro.observe(document.querySelector("#smooth-content")!);
      return () => { ro.disconnect(); clearTimeout(t); sized.revert(); splits.forEach((s) => s.revert()); };
    });
  }, { scope: root });

  return (
    <div id="smooth-wrapper" ref={root}>
      <div id="smooth-content">{children}</div>
    </div>
  );
}
