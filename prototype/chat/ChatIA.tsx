// Chat du dashboard (labo) : un petit personnage en bas à droite ; un clic ouvre le chat construit sur PromptInputBox
// (components/ui/ai-prompt-box.tsx, le composant fourni). AUCUN assistant n'est branché côté serveur :
// un message envoyé reste dans le fil avec une note honnête, rien n'est inventé ni payé.
// Le panneau n'est jamais démonté : fermer garde la conversation et le brouillon tant que la page est ouverte.
import React from "react";
import { X } from "lucide-react";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";

type Message = { id: number; role: "moi" | "note"; texte: string };

// Le personnage : un visage dessiné au trait, original (pas la mascotte d'une autre marque).
function Personnage({ size = 38 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 10.500c.800-3.500 4-5.500 7.500-5 2 .300 3.200 1.200 4 2.500" />
      <path d="M6.500 17c0-5.500 4.200-9.500 9.500-9.500s9.500 4 9.500 9.500-4.200 9-9.500 9-9.500-3.700-9.500-9z" />
      <circle cx="12.300" cy="16" r="1.300" fill="currentColor" stroke="none" />
      <circle cx="19.700" cy="16" r="1.300" fill="currentColor" stroke="none" />
      <path d="M13 20.300c1.700 1.300 4.300 1.300 6 0" />
    </svg>
  );
}

export function ChatIA() {
  const [open, setOpen] = React.useState(false);
  const [msgs, setMsgs] = React.useState<Message[]>([]);
  const launch = React.useRef<HTMLButtonElement>(null);
  const panel = React.useRef<HTMLDivElement>(null);
  const log = React.useRef<HTMLDivElement>(null);
  const follow = React.useRef(true);
  const reading = React.useRef(0); // où on lisait dans le fil à la fermeture
  const id = React.useRef(0);

  // Ouvrir : le focus va dans la zone de saisie. Fermer : il revient au personnage.
  const toggle = React.useCallback((next: boolean, refocus = true) => {
    if (!next && log.current) reading.current = log.current.scrollTop;
    setOpen(next);
    document.documentElement.classList.toggle("chat-ouvert", next);
    if (next) requestAnimationFrame(() => panel.current?.querySelector("textarea")?.focus({ preventScroll: true }));
    else if (refocus) launch.current?.focus();
  }, []);

  // Téléphone : le panneau suit la partie visible de l'écran, pour que la saisie reste au-dessus du clavier.
  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const fit = () => {
      panel.current?.style.setProperty("--chat-h", `${vv.height}px`);
      panel.current?.style.setProperty("--chat-top", `${vv.offsetTop}px`);
    };
    fit();
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
    return () => { vv.removeEventListener("resize", fit); vv.removeEventListener("scroll", fit); };
  }, []);

  // Un panneau masqué perd sa position de défilement : on la remet dès qu'il réapparaît.
  React.useLayoutEffect(() => {
    if (open && log.current) log.current.scrollTop = reading.current;
  }, [open]);

  // Le fil ne redescend que si on était déjà en bas (ou pour son propre envoi) : lire l'historique n'est jamais interrompu.
  React.useLayoutEffect(() => {
    if (follow.current && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [msgs]);

  const onSend = (message: string, files?: File[]) => {
    follow.current = true;
    const extra = files?.length ? ` (${files.length} image jointe)` : "";
    setMsgs(m => [
      ...m,
      { id: ++id.current, role: "moi", texte: message + extra },
      { id: ++id.current, role: "note", texte: "L'assistant n'est pas encore branché : ton message n'est parti nulle part." },
    ]);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && !e.defaultPrevented && !document.querySelector('[role="dialog"][data-state="open"]')) {
      e.preventDefault();
      toggle(false);
    }
  };

  return (
    <>
      <div
        ref={panel}
        id="renzvi-chat-panel"
        role="dialog"
        aria-labelledby="renzvi-chat-titre"
        hidden={!open}
        onKeyDown={onKeyDown}
        className="chat-ia-panel flex flex-col overflow-hidden rounded-3xl border border-[#333333] bg-[#141517] text-gray-100 shadow-[0_16px_48px_rgba(0,0,0,0.35)]"
      >
        <header className="flex items-center gap-3 px-4 pt-4 pb-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[#1F2023]"><Personnage size={24} /></span>
          <div className="min-w-0 flex-1">
            <h2 id="renzvi-chat-titre" className="text-[15px] font-semibold leading-5 text-gray-100">Assistant</h2>
            <p id="renzvi-chat-statut" className="text-[13px] leading-[18px] text-gray-400">Pas encore branché</p>
          </div>
          <button
            type="button"
            onClick={() => toggle(false)}
            aria-label="Réduire le chat"
            title="Réduire le chat"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-gray-300 transition-colors hover:bg-[#2E3033] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div
          ref={log}
          role="log"
          aria-label="Messages"
          tabIndex={0}
          onScroll={e => { const n = e.currentTarget; follow.current = n.scrollHeight - n.scrollTop - n.clientHeight < 48; }}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3"
        >
          {msgs.length === 0 ? (
            <div className="grid h-full content-center justify-items-center gap-2 px-4 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-white text-[#1F2023]"><Personnage size={36} /></span>
              <p className="text-[15px] font-semibold text-gray-100">Aucun message pour l’instant.</p>
              <p className="text-sm leading-relaxed text-gray-400">L'assistant n'est pas encore branché : tu peux écrire, mais personne ne répondra pour le moment.</p>
            </div>
          ) : (
            <ol className="flex flex-col gap-3">
              {msgs.map(m => m.role === "moi" ? (
                <li key={m.id} className="max-w-[85%] self-end whitespace-pre-wrap break-words rounded-2xl bg-[#2E3033] px-3.5 py-2 text-[15px] leading-normal text-gray-100">{m.texte}</li>
              ) : (
                <li key={m.id} className="max-w-[85%] self-end text-right text-[13px] leading-snug text-red-300">{m.texte}</li>
              ))}
            </ol>
          )}
        </div>

        <div className="chat-ia-compose px-3 pb-3">
          <PromptInputBox onSend={onSend} placeholder="Écris ton message…" />
        </div>
      </div>

      <button
        ref={launch}
        type="button"
        onClick={() => toggle(!open)}
        aria-label={open ? "Fermer le chat" : "Ouvrir le chat"}
        title={open ? "Fermer le chat" : "Ouvrir le chat"}
        aria-expanded={open}
        aria-controls="renzvi-chat-panel"
        className="chat-ia-launch grid place-items-center rounded-full bg-white text-[#1F2023] shadow-[0_6px_20px_rgba(23,25,28,0.22)] ring-1 ring-black/5 transition-transform hover:-translate-y-0.5 active:scale-95"
      >
        {open ? <X className="h-5 w-5" /> : <Personnage />}
      </button>
    </>
  );
}
