"use client";

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { DayPicker, type ClassNames, type CustomComponents } from "react-day-picker";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type CalendarProps = ComponentProps<typeof DayPicker>;

const navButton = "grid size-9 place-items-center rounded-lg bg-transparent text-[var(--slate,#575b63)] hover:bg-[var(--tint,#f1f3f4)] disabled:pointer-events-none disabled:opacity-40";
const defaultClassNames: Partial<ClassNames> = {
  months: "relative flex flex-col gap-4 sm:flex-row",
  month: "w-full",
  month_caption: "mx-10 mb-1 flex h-9 items-center justify-center",
  caption_label: "text-sm font-semibold",
  nav: "absolute inset-x-0 top-0 flex justify-between",
  button_previous: navButton,
  button_next: navButton,
  month_grid: "w-full border-collapse",
  weekday: "size-9 p-0 text-xs font-medium text-[var(--slate,#575b63)]",
  day: "group relative size-9 p-0 text-sm",
  day_button: cn(
    "relative grid size-9 place-items-center rounded-lg bg-transparent p-0 tabular-nums",
    "hover:bg-[var(--tint,#f1f3f4)] focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent,#2563eb)]",
    "group-data-[outside]:text-[var(--slate,#575b63)] group-data-[disabled]:opacity-35 group-data-[disabled]:line-through",
    "group-data-[selected]:bg-[var(--accent,#2563eb)] group-data-[selected]:text-[var(--on-accent,#fff)]",
    "group-[.range-start:not(.range-end)]:rounded-e-none group-[.range-end:not(.range-start)]:rounded-s-none group-[.range-middle]:rounded-none",
    "group-[.range-middle]:bg-[var(--tint,#f1f3f4)] group-[.range-middle]:text-[var(--ink,#202124)]",
  ),
  range_start: "range-start",
  range_middle: "range-middle",
  range_end: "range-end",
  today: "after:pointer-events-none after:absolute after:bottom-[3px] after:left-1/2 after:size-[3px] after:-translate-x-1/2 after:rounded-full after:bg-[var(--accent,#2563eb)] [&[data-selected]:not(.range-middle)]:after:bg-[var(--on-accent,#fff)]",
  hidden: "invisible",
  week_number: "size-9 p-0 text-xs text-[var(--slate,#575b63)]",
};

const Chevron: CustomComponents["Chevron"] = ({ orientation, size = 16, className }) => {
  const Icon = { left: ChevronLeft, right: ChevronRight, up: ChevronUp, down: ChevronDown }[orientation ?? "left"];
  return <Icon size={size} className={className} aria-hidden="true" />;
};

export function Calendar({ className, classNames, components, showOutsideDays = true, ...props }: CalendarProps) {
  const merged = { ...defaultClassNames, ...classNames };
  for (const key of Object.keys(defaultClassNames) as (keyof ClassNames)[]) {
    merged[key] = cn(defaultClassNames[key], classNames?.[key]);
  }
  return (
    <DayPicker
      {...props}
      className={cn("w-fit", className)}
      classNames={merged}
      components={{ Chevron, ...components }}
      showOutsideDays={showOutsideDays}
    />
  );
}
