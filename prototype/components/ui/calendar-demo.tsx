"use client";

import { useState } from "react";
import { fr } from "date-fns/locale/fr";
import { Calendar } from "@/components/ui/calendar";

export function CalendarDemo() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  return <Calendar mode="single" locale={fr} selected={date} onSelect={setDate} className="rounded-lg border p-2" />;
}
