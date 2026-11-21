"use client";

import { motion, useReducedMotion, useSpring } from "framer-motion";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import Link from "next/link";
import { Check, Star as LucideStar } from "lucide-react";
import NumberFlow from "@number-flow/react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function useMediaQuery(query: string) {
  const [value, setValue] = useState(false);

  useEffect(() => {
    const result = matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setValue(event.matches);
    result.addEventListener("change", onChange);
    setValue(result.matches);

    return () => result.removeEventListener("change", onChange);
  }, [query]);

  return value;
}

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-[hsl(var(--accent))] hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-[hsl(var(--accent))] hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

type Pointer = { x: number; y: number; width: number; height: number };

function Star({ mousePosition }: { mousePosition: Pointer | null }) {
  const [star] = useState(() => ({
    top: Math.random(),
    left: Math.random(),
    width: 1 + Math.random() * 2,
    height: 1 + Math.random() * 2,
    duration: 2 + Math.random() * 3,
    delay: Math.random() * 5,
  }));

  const springConfig = { stiffness: 100, damping: 15, mass: 0.1 };
  const springX = useSpring(0, springConfig);
  const springY = useSpring(0, springConfig);

  useEffect(() => {
    if (!mousePosition) {
      springX.set(0);
      springY.set(0);
      return;
    }

    const deltaX = mousePosition.x - star.left * mousePosition.width;
    const deltaY = mousePosition.y - star.top * mousePosition.height;
    const distance = Math.hypot(deltaX, deltaY);
    const force = Math.max(0, 1 - distance / 600) * 0.5;
    springX.set(deltaX * force);
    springY.set(deltaY * force);
  }, [mousePosition, star, springX, springY]);

  return (
    <motion.div
      className="absolute bg-foreground rounded-full"
      style={{ top: `${star.top * 100}%`, left: `${star.left * 100}%`, width: star.width, height: star.height, x: springX, y: springY }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 0] }}
      transition={{ duration: star.duration, repeat: Infinity, delay: star.delay }}
    />
  );
}

function InteractiveStarfield({ mousePosition }: { mousePosition: Pointer | null }) {
  return (
    <div aria-hidden="true" data-pricing-starfield className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
      {Array.from({ length: 150 }, (_, i) => <Star key={i} mousePosition={mousePosition} />)}
    </div>
  );
}

export interface PricingPlan {
  name: string;
  price: string;
  yearlyPrice: string;
  annualTotal?: string;
  period: string;
  features: string[];
  description: string;
  buttonText: string;
  href: string;
  isPopular?: boolean;
}

interface PricingSectionProps {
  plans: PricingPlan[];
  title?: string;
  description?: string;
  currency?: string;
  locale?: string;
}

const PricingContext = createContext({
  isMonthly: true,
  setIsMonthly: (_value: boolean) => {},
});

export function PricingSection({
  plans,
  title = "Simple, Transparent Pricing",
  description = "Choose the plan that's right for you. All plans include our core features and support.",
  currency = "USD",
  locale = "en-US",
}: PricingSectionProps) {
  const [isMonthly, setIsMonthly] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [mousePosition, setMousePosition] = useState<Pointer | null>(null);
  const reduceMotion = useReducedMotion();

  // Random star positions are generated after hydration, then kept across pointer moves.
  useEffect(() => setMounted(true), []);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (reduceMotion) return;
    const box = event.currentTarget.getBoundingClientRect();
    setMousePosition({ x: event.clientX - box.left, y: event.clientY - box.top, width: box.width, height: box.height });
  };

  return (
    <PricingContext.Provider value={{ isMonthly, setIsMonthly }}>
      <div
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setMousePosition(null)}
        className="relative w-full bg-background dark:bg-neutral-950 py-20 sm:py-24"
      >
        {mounted && !reduceMotion && <InteractiveStarfield mousePosition={mousePosition} />}
        <div className="relative z-10 container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-12">
            <h1 lang="en" className="text-4xl font-bold tracking-tighter sm:text-5xl text-neutral-900 dark:text-white">{title}</h1>
            <p className="text-muted-foreground text-lg whitespace-pre-line">{description}</p>
          </div>
          <PricingToggle />
          <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 items-start gap-8">
            {plans.map((plan, index) => <PricingCard key={plan.name} plan={plan} index={index} currency={currency} locale={locale} />)}
          </div>
        </div>
      </div>
    </PricingContext.Provider>
  );
}

function PricingToggle() {
  const { isMonthly, setIsMonthly } = useContext(PricingContext);
  const monthlyBtnRef = useRef<HTMLButtonElement>(null);
  const annualBtnRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  const [pillStyle, setPillStyle] = useState({ width: 0, x: 0 });

  useEffect(() => {
    const button = (isMonthly ? monthlyBtnRef : annualBtnRef).current;
    if (!button) return;
    const measure = () => setPillStyle({ width: button.offsetWidth, x: button.offsetLeft });
    measure();
    const observer = new ResizeObserver(measure);
    if (monthlyBtnRef.current) observer.observe(monthlyBtnRef.current);
    if (annualBtnRef.current) observer.observe(annualBtnRef.current);
    return () => observer.disconnect();
  }, [isMonthly]);

  const handleToggle = (monthly: boolean) => {
    if (isMonthly === monthly) return;
    setIsMonthly(monthly);

    if (!monthly && !reduceMotion) {
      const rect = annualBtnRef.current?.getBoundingClientRect();
      if (!rect) return;
      confetti({
        particleCount: 80,
        spread: 80,
        origin: {
          x: (rect.left + rect.width / 2) / window.innerWidth,
          y: (rect.top + rect.height / 2) / window.innerHeight,
        },
        colors: ["#18181b", "#a1a1aa", "#e4e4e7"],
        ticks: 300,
        gravity: 1.2,
        decay: 0.94,
        startVelocity: 30,
        disableForReducedMotion: true,
      });
    }
  };

  return (
    <div className="flex justify-center">
      <div role="group" aria-label="Billing frequency" lang="en" className="relative flex w-fit items-center rounded-full bg-muted p-1">
        <motion.div
          aria-hidden="true"
          className="absolute left-0 top-0 h-full rounded-full bg-primary p-1"
          initial={false}
          animate={pillStyle}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
        />
        <button
          type="button"
          ref={monthlyBtnRef}
          aria-pressed={isMonthly}
          onClick={() => handleToggle(true)}
          className={cn("relative z-10 rounded-full px-4 sm:px-6 py-2 text-sm font-medium transition-colors", isMonthly ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          Monthly
        </button>
        <button
          type="button"
          ref={annualBtnRef}
          aria-pressed={!isMonthly}
          onClick={() => handleToggle(false)}
          className={cn("relative z-10 rounded-full px-4 sm:px-6 py-2 text-sm font-medium transition-colors", !isMonthly ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          Annual
          <span className={cn("hidden sm:inline", !isMonthly && "text-primary-foreground/80")}> (Save 20%)</span>
        </button>
      </div>
    </div>
  );
}

function PricingCard({ plan, index, currency, locale }: { plan: PricingPlan; index: number; currency: string; locale: string }) {
  const { isMonthly } = useContext(PricingContext);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const reduceMotion = useReducedMotion();
  const price = Number(isMonthly ? plan.price : plan.yearlyPrice);
  const format = { style: "currency", currency, minimumFractionDigits: price ? 2 : 0 } as const;
  const annualTotal = plan.annualTotal && new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(plan.annualTotal));

  return (
    <motion.article
      initial={reduceMotion ? false : { y: 50, opacity: 0 }}
      whileInView={{ y: plan.isPopular && isDesktop && !reduceMotion ? -20 : 0, opacity: 1 }}
      viewport={{ once: true }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.6, type: "spring", stiffness: 100, damping: 20, delay: index * 0.15 }}
      className={cn(
        "rounded-2xl p-8 flex flex-col relative bg-background/70 backdrop-blur-sm",
        plan.isPopular ? "border-2 border-primary shadow-xl" : "border border-border",
      )}
    >
      {plan.isPopular && (
        <div className="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2">
          <div className="bg-primary py-1.5 px-4 rounded-full flex items-center gap-1.5">
            <LucideStar className="text-primary-foreground h-4 w-4 fill-current" aria-hidden="true" />
            <span lang="en" className="text-primary-foreground text-sm font-semibold whitespace-nowrap">Most Popular</span>
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col text-center">
        <h2 className="text-xl font-semibold text-foreground">{plan.name}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
        <div className="mt-6 flex flex-wrap items-baseline justify-center gap-x-1">
          <span className="text-5xl font-bold tracking-tight text-foreground tabular-nums">
            <span className="sr-only">{new Intl.NumberFormat(locale, format).format(price)}</span>
            <NumberFlow value={price} format={format} locales={locale} aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold leading-6 tracking-wide text-muted-foreground">/ {plan.period}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          <span lang="en">{isMonthly ? "Billed Monthly" : "Billed Annually"}</span>
          {!isMonthly && annualTotal && ` · ${annualTotal} TTC / an`}
        </p>

        <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-left text-muted-foreground">
          {plan.features.map(feature => (
            <li key={feature} className="flex gap-x-3">
              <Check className="h-6 w-5 flex-none text-primary" aria-hidden="true" />
              {feature}
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-8">
          <Button asChild variant={plan.isPopular ? "default" : "outline"} size="lg" className="w-full">
            <Link href={plan.href}>{plan.buttonText}</Link>
          </Button>
        </div>
      </div>
    </motion.article>
  );
}
