"use client";

import { useState, type MouseEvent, type PointerEvent } from "react";
import NumberFlow from "@number-flow/react";
import { ArrowRight, Check } from "lucide-react";

export type PricingPlan = {
  name: string;
  monthlyCents: number;
  description: string;
  features: string[];
  recommended?: boolean;
  href?: string;
};

const ANNUAL_DISCOUNT = 20;
const euro = { style: "currency", currency: "EUR", trailingZeroDisplay: "stripIfInteger" } as const;
const formatEuro = new Intl.NumberFormat("fr-FR", euro);
const stars = Array.from({ length: 60 }, (_, i) => ({
  left: `${((i * 419 + 103) % 997) / 10}%`,
  top: `${((i * 269 + 71) % 991) / 10}%`,
  opacity: 0.18 + (i % 4) * 0.12,
}));

function moveStars(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== "mouse") return;
  const section = event.currentTarget;
  const box = section.getBoundingClientRect();
  section.style.setProperty("--pricing-star-x", `${(event.clientX - box.left - box.width / 2) / 30}px`);
  section.style.setProperty("--pricing-star-y", `${(event.clientY - box.top - box.height / 2) / 30}px`);
}

export function PricingSection({ plans }: { plans: readonly PricingPlan[] }) {
  const [annual, setAnnual] = useState(false);

  function chooseAnnual(event: MouseEvent<HTMLButtonElement>) {
    if (annual) return;
    setAnnual(true);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const button = event.currentTarget.getBoundingClientRect();
    void import("canvas-confetti").then(({ default: confetti }) => confetti({
      particleCount: 36,
      spread: 58,
      origin: { x: (button.left + button.width / 2) / innerWidth, y: (button.top + button.height / 2) / innerHeight },
      colors: ["#2563eb", "#93c5fd", "#dbeafe"],
      disableForReducedMotion: true,
      ticks: 130,
    }));
  }

  return (
    <section id="offres" aria-labelledby="tarifs-titre" className="px-[var(--m)] pt-32 lg:pt-48">
      <div
        onPointerMove={moveStars}
        onPointerLeave={({ currentTarget }) => {
          currentTarget.style.removeProperty("--pricing-star-x");
          currentTarget.style.removeProperty("--pricing-star-y");
        }}
        className="relative isolate overflow-hidden rounded-box bg-lin px-4 py-12 sm:px-8 lg:px-10 lg:py-16"
      >
        <div aria-hidden="true" className="pricing-stars pointer-events-none absolute -inset-6 -z-10 text-accent">
          {stars.map((style, index) => <span key={index} className="absolute size-[2px] rounded-full bg-current" style={style} />)}
        </div>

        <div className="mx-auto max-w-[1120px]">
          <header className="mx-auto grid max-w-[50ch] justify-items-center gap-4 text-center">
            <h2 id="tarifs-titre" tabIndex={-1}>Tarifs</h2>
            <p data-rise className="text-soft">Commence gratuitement. Les tarifs Pro et Worker sont prévus pour le lancement.</p>
            <div data-rise role="group" aria-label="Fréquence de facturation"
              className="mt-2 inline-flex gap-1 rounded-full bg-white p-1 ring-1 ring-black/8">
              <button type="button" aria-pressed={!annual} onClick={() => setAnnual(false)}
                className="pricing-frequency">Mensuel</button>
              <button type="button" aria-pressed={annual} onClick={chooseAnnual}
                className="pricing-frequency">Annuel <span className="ml-1">−{ANNUAL_DISCOUNT} %</span></button>
            </div>
          </header>

          <div className="mt-8 grid gap-3 md:grid-cols-3 lg:mt-10 lg:gap-4">
            {plans.map(plan => {
              const annualCents = Math.round(plan.monthlyCents * 12 * (100 - ANNUAL_DISCOUNT) / 100);
              const price = (annual ? annualCents / 12 : plan.monthlyCents) / 100;
              return (
                <article key={plan.name} data-rise className={`flex flex-col rounded-box bg-white p-5 lg:p-7 ${plan.recommended ? "ring-2 ring-accent" : "ring-1 ring-black/8"}`}>
                  <h3 className="text-statement leading-tight font-semibold">{plan.name}</h3>
                  <p className="mt-1 text-small text-soft">{plan.description}</p>
                  <p className="mt-5 flex flex-wrap items-baseline gap-x-1.5">
                    <span className="sr-only">{formatEuro.format(price)}</span>
                    <NumberFlow aria-hidden="true" value={price} locales="fr-FR" format={euro} className="text-[clamp(2rem,3.5vw,3.25rem)] leading-none font-semibold tracking-tight tabular-nums" />
                    <span className="text-small text-soft">/ mois</span>
                  </p>
                  <p className="mt-2 text-small text-soft">
                    {plan.monthlyCents === 0 ? "Gratuit, sans carte" : annual ? `${formatEuro.format(annualCents / 100)} TTC facturés par an` : "TTC, facturé chaque mois"}
                  </p>
                  <ul className="mt-5 grid gap-2.5 pb-6 text-small">
                    {plan.features.map(feature => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <Check aria-hidden="true" className="mt-[2px] size-4 shrink-0 text-accent" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto">
                    {plan.href ? (
                      <a href={plan.href} className="btn btn-accent w-full gap-2">
                        Créer mon espace <ArrowRight aria-hidden="true" className="size-4" />
                      </a>
                    ) : (
                      <p className="flex min-h-12 items-center justify-center rounded-full bg-lin text-small font-semibold text-soft">
                        Bientôt disponible
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
