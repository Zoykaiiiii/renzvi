// Chat du dashboard (labo) : un petit personnage en bas à droite ; un clic ouvre le chat construit sur PromptInputBox
// (components/ui/ai-prompt-box.tsx, le composant fourni). AUCUN assistant n'est branché côté serveur :
// un message envoyé reste dans le fil avec une note honnête, rien n'est inventé ni payé.
// Le panneau n'est jamais démonté : fermer garde la conversation et le brouillon tant que la page est ouverte.
import React from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { LiveOrb, WEBGL_COLORS } from "@/components/ui/live-orb";

type Message = { id: number; role: "moi" | "note"; texte: string };

// Réglages du chat, choisis dans « Personnaliser le chat » et gardés sur cet appareil.
// shortcut: localStorage seulement (pas suivi d'un appareil à l'autre) ; passer par le compte (LOOK du dashboard) si Damien le veut partout.
type Style = "verre" | "nuit";
type Orbe = "irise" | "accent" | "blanc" | "noir";
type Reglages = { style: Style; orbe: Orbe };
const STYLES: { id: Style; nom: string }[] = [{ id: "verre", nom: "Verre" }, { id: "nuit", nom: "Nuit" }];
const ORBES: { id: Orbe; nom: string; fond: string }[] = [
  { id: "irise", nom: "Irisé", fond: `linear-gradient(135deg, ${WEBGL_COLORS.join(", ")})` },
  { id: "accent", nom: "Couleur du thème", fond: "var(--accent, #7C5CFF)" },
  { id: "blanc", nom: "Blanc", fond: "#F4F4F5" },
  { id: "noir", nom: "Noir", fond: "#18181B" },
];
const CLE = "renzvi:chat";
function lireReglages(): Reglages {
  try {
    const r = JSON.parse(localStorage.getItem(CLE) || "{}");
    return {
      style: STYLES.some(x => x.id === r.style) ? r.style : "verre",
      orbe: ORBES.some(x => x.id === r.orbe) ? r.orbe : "irise",
    };
  } catch { return { style: "verre", orbe: "irise" }; }
}
// La couleur d'accent choisie dans Personnaliser (hexadécimale), pour le personnage « Couleur du thème ».
function accentDuTheme() {
  const css = getComputedStyle(document.documentElement);
  const hex = (v: string, d: string) => (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(v.trim()) ? v.trim() : d);
  return { color: hex(css.getPropertyValue("--accent"), "#7C5CFF"), eyeColor: hex(css.getPropertyValue("--on-accent"), "#FAFAFA") };
}

// Le personnage de l'assistant : LiveOrb (components/ui/live-orb.tsx, composant fourni).
// Sans WebGL, le composant montre lui-même un visage en CSS. Décoratif : le nom vient du bouton ou du titre.
function Personnage({ size, orbe, accent }: { size: number; orbe: Orbe; accent: { color: string; eyeColor: string } }) {
  const props = orbe === "irise" ? { variant: "webgl" as const }
    : orbe === "accent" ? { variant: "custom" as const, ...accent }
    : { variant: orbe === "blanc" ? "white" as const : "black" as const };
  return <span aria-hidden="true" className="grid shrink-0"><LiveOrb size={size} {...props} /></span>;
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
  const [reglages, setReglages] = React.useState<Reglages>({ style: "verre", orbe: "irise" });
  const [perso, setPerso] = React.useState(false); // la zone « Personnaliser le chat » est ouverte
  const [accent, setAccent] = React.useState({ color: "#7C5CFF", eyeColor: "#FAFAFA" });
  React.useEffect(() => { setReglages(lireReglages()); setAccent(accentDuTheme()); }, []);
  const regler = (r: Partial<Reglages>) => setReglages(prev => {
    const next = { ...prev, ...r };
    try { localStorage.setItem(CLE, JSON.stringify(next)); } catch {}
    return next;
  });

  // Ouvrir : le focus va dans la zone de saisie. Fermer : il revient au personnage.
  const toggle = React.useCallback((next: boolean, refocus = true) => {
    if (!next && log.current) reading.current = log.current.scrollTop;
    setOpen(next);
    if (next) setAccent(accentDuTheme());
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
      { id: ++id.current, role: "note", texte: "Zvi n'est pas encore branché : ton message n'est parti nulle part." },
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
        data-style={reglages.style}
        className="chat-ia-panel flex flex-col overflow-hidden rounded-3xl border border-[var(--chat-edge)] bg-[var(--chat-bg)] text-[var(--chat-ink)]"
      >
        <header className="flex items-center gap-3 px-4 pt-4 pb-3">
          <Personnage size={36} orbe={reglages.orbe} accent={accent} />
          <div className="min-w-0 flex-1">
            <h2 id="renzvi-chat-titre" className="text-[15px] font-semibold leading-5">Zvi</h2>
            <p id="renzvi-chat-statut" className="text-[13px] leading-[18px] text-[var(--chat-muted)]">Pas encore branché</p>
          </div>
          <button
            type="button"
            onClick={() => setPerso(v => !v)}
            aria-label="Personnaliser le chat"
            title="Personnaliser le chat"
            aria-expanded={perso}
            aria-controls="renzvi-chat-perso"
            className="chat-ia-icon grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--chat-muted)] transition-colors hover:bg-[var(--chat-hover)] hover:text-[var(--chat-ink)]"
          >
            <SlidersHorizontal className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => toggle(false)}
            aria-label="Réduire le chat"
            title="Réduire le chat"
            className="chat-ia-icon grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--chat-muted)] transition-colors hover:bg-[var(--chat-hover)] hover:text-[var(--chat-ink)]"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div id="renzvi-chat-perso" hidden={!perso} className="mx-4 mb-3 grid gap-3 rounded-2xl bg-[var(--chat-bubble)] p-3">
          <div role="group" aria-labelledby="renzvi-chat-style" className="grid gap-1.5">
            <p id="renzvi-chat-style" className="text-[13px] text-[var(--chat-muted)]">Style</p>
            <div className="grid grid-cols-2 gap-1.5">
              {STYLES.map(x => (
                <button key={x.id} type="button" aria-pressed={reglages.style === x.id} onClick={() => regler({ style: x.id })}
                  className="chat-ia-choix h-10 rounded-xl text-sm font-medium">{x.nom}</button>
              ))}
            </div>
          </div>
          <div role="group" aria-labelledby="renzvi-chat-orbe" className="grid gap-1.5">
            <p id="renzvi-chat-orbe" className="text-[13px] text-[var(--chat-muted)]">Personnage</p>
            <div className="grid grid-cols-4 gap-1.5">
              {ORBES.map(x => (
                <button key={x.id} type="button" aria-pressed={reglages.orbe === x.id} onClick={() => regler({ orbe: x.id })}
                  className="chat-ia-choix grid min-h-[64px] justify-items-center gap-1 rounded-xl px-1 py-2 text-xs leading-tight">
                  <span aria-hidden="true" className="h-7 w-7 rounded-full ring-1 ring-[var(--chat-edge)]" style={{ background: x.fond }} />
                  {x.nom}
                </button>
              ))}
            </div>
          </div>
        </div>

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
              <Personnage size={64} orbe={reglages.orbe} accent={accent} />
              <p className="text-[15px] font-semibold">Aucun message pour l’instant.</p>
              <p className="text-sm leading-relaxed text-[var(--chat-muted)]">Zvi n'est pas encore branché : tu peux écrire, mais personne ne répondra pour le moment.</p>
            </div>
          ) : (
            <ol className="flex flex-col gap-3">
              {msgs.map(m => m.role === "moi" ? (
                <li key={m.id} className="max-w-[85%] self-end whitespace-pre-wrap break-words rounded-2xl bg-[var(--chat-bubble)] px-3.5 py-2 text-[15px] leading-normal">{m.texte}</li>
              ) : (
                <li key={m.id} className="max-w-[85%] self-end text-right text-[13px] leading-snug text-[var(--chat-error)]">{m.texte}</li>
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
        aria-label={open ? "Fermer Zvi" : "Ouvrir Zvi"}
        title={open ? "Fermer Zvi" : "Ouvrir Zvi"}
        aria-expanded={open}
        aria-controls="renzvi-chat-panel"
        className={`chat-ia-launch grid place-items-center rounded-full shadow-[0_6px_20px_rgba(23,25,28,0.22)] transition-transform hover:-translate-y-0.5 active:scale-95 ${open ? "bg-[var(--paper,#fff)] text-[var(--ink,#1F2023)] ring-1 ring-black/5" : ""}`}
      >
        {open ? <X className="h-5 w-5" /> : <Personnage size={52} orbe={reglages.orbe} accent={accent} />}
      </button>
    </>
  );
}
