import { createRoot } from "react-dom/client";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale/fr";
import { Calendar } from "@/components/ui/calendar";

export function openCalendar(input: HTMLInputElement, label: string) {
  if (!input.isConnected || input.matches(":disabled,[readonly]") || document.querySelector(".date-calendar-dialog[open]")) return;

  const selected = input.value ? parseISO(input.value) : undefined;
  const min = input.min ? parseISO(input.min) : undefined;
  const max = input.max ? parseISO(input.max) : undefined;
  const dialog = document.createElement("dialog");
  dialog.className = "date-calendar-dialog";
  dialog.setAttribute("aria-label", label);
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });
  document.body.append(dialog);
  const root = createRoot(dialog);
  dialog.addEventListener("close", () => {
    root.unmount();
    dialog.remove();
  }, { once: true });

  function choose(value: string) {
    dialog.close();
    if (input.isConnected && input.value !== value) {
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  dialog.showModal();
  root.render(
    <div className="date-calendar-panel">
      <header className="date-calendar-head">
        <h2>{label}</h2>
        <button type="button" aria-label="Fermer le calendrier" onClick={() => dialog.close()}>×</button>
      </header>
      <Calendar
        mode="single"
        autoFocus
        locale={fr}
        selected={selected}
        defaultMonth={selected}
        startMonth={min}
        endMonth={max}
        disabled={[...(min ? [{ before: min }] : []), ...(max ? [{ after: max }] : [])]}
        labels={{
          labelPrevious: () => "Mois précédent",
          labelNext: () => "Mois suivant",
          labelDayButton: (day, modifiers) => format(day, "PPPP", { locale: fr }) + (modifiers.today ? ", aujourd’hui" : ""),
        }}
        onDayClick={day => choose(format(day, "yyyy-MM-dd"))}
      />
      {!input.required && selected && (
        <button type="button" className="date-calendar-clear" onClick={() => choose("")}>Effacer la date</button>
      )}
    </div>,
  );
}
