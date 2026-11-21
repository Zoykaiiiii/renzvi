// Le panneau n'est jamais démonté : fermer garde la conversation et le brouillon tant que la page est ouverte.
import React from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { LiveOrb, WEBGL_COLORS, type LiveOrbExpression } from "@/components/ui/live-orb";

type Historique = { role: "user" | "assistant"; content: string }[];
type Envoi = { texte: string; fichiers?: File[]; historique?: Historique };
type Message = { id: number; texte: string } & (
  { role: "moi" | "note" | "zvi" } | { role: "erreur"; envoi: Envoi }
);
// Le service résout la promesse quand la réponse entière est prête.
export type Repondre = (envoi: Envoi, signal: AbortSignal, historique: Historique) => Promise<string>;

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
function Personnage({ size, orbe, accent, expression }: { size: number; orbe: Orbe; accent: { color: string; eyeColor: string }; expression: LiveOrbExpression }) {
  const props = orbe === "irise" ? { variant: "webgl" as const }
    : orbe === "accent" ? { variant: "custom" as const, ...accent }
    : { variant: orbe === "blanc" ? "white" as const : "black" as const };
  return <span aria-hidden="true" className="pointer-events-none grid shrink-0"><LiveOrb interactive={false} size={size} expression={expression} {...props} /></span>;
}

export function ChatIA({ repondre }: { repondre?: Repondre }) {
  const [open, setOpen] = React.useState(false);
  const [msgs, setMsgs] = React.useState<Message[]>([]);
  const [pending, setPending] = React.useState(false);
  const [reaction, setReaction] = React.useState<LiveOrbExpression>("idle");
  const reactionTimer = React.useRef(0);
  const request = React.useRef<AbortController | null>(null);
  const launch = React.useRef<HTMLButtonElement>(null);
  const panel = React.useRef<HTMLDivElement>(null);
  const log = React.useRef<HTMLDivElement>(null);
  const follow = React.useRef(true);
  const reading = React.useRef(0); // où on lisait dans le fil à la fermeture
  const id = React.useRef(0);
  const [reglages, setReglages] = React.useState<Reglages>({ style: "verre", orbe: "irise" });
  const [perso, setPerso] = React.useState(false); // la zone « Personnaliser le chat » est ouverte
  const [accent, setAccent] = React.useState({ color: "#7C5CFF", eyeColor: "#FAFAFA" });
  const reagir = React.useCallback((expression: LiveOrbExpression) => {
    clearTimeout(reactionTimer.current);
    setReaction(expression);
    if (expression !== "idle") reactionTimer.current = window.setTimeout(() => setReaction("idle"), 650);
  }, []);
  const annuler = React.useCallback(() => {
    request.current?.abort();
    request.current = null;
    setPending(false);
  }, []);
  React.useEffect(() => () => {
    clearTimeout(reactionTimer.current);
    request.current?.abort();
    request.current = null;
  }, []);
  React.useEffect(() => { setReglages(lireReglages()); setAccent(accentDuTheme()); }, []);
  const regler = (r: Partial<Reglages>) => setReglages(prev => {
    const next = { ...prev, ...r };
    try { localStorage.setItem(CLE, JSON.stringify(next)); } catch {}
    return next;
  });

  // Ouvrir : le focus va dans la zone de saisie. Fermer : il revient au personnage.
  const toggle = React.useCallback((next: boolean, refocus = true) => {
    if (!next && log.current) reading.current = log.current.scrollTop;
    if (!next) annuler();
    reagir(next ? "opened" : "idle");
    setOpen(next);
    if (next) setAccent(accentDuTheme());
    document.documentElement.classList.toggle("chat-ouvert", next);
    if (next) requestAnimationFrame(() => panel.current?.querySelector("textarea")?.focus({ preventScroll: true }));
    else if (refocus) launch.current?.focus();
  }, [annuler, reagir]);

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

  const demander = async (envoi: Envoi, retryId?: number) => {
    if (!repondre || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    follow.current = true;
    reagir("idle");
    setPending(true);
    if (retryId !== undefined) {
      panel.current?.querySelector("textarea")?.focus({ preventScroll: true });
      setMsgs(m => m.filter(x => x.id !== retryId));
    }
    try {
      const texte = await repondre(envoi, controller.signal, envoi.historique ?? []);
      if (request.current !== controller) return;
      const reply: Message = { id: ++id.current, role: "zvi", texte };
      setMsgs(m => [...m, reply]);
      reagir("replied");
    } catch (e) {
      if (request.current !== controller) return;
      const texte = e instanceof Error && e.name === "ZviErreur" ? e.message : "La réponse n’a pas abouti.";
      const error: Message = { id: ++id.current, role: "erreur", texte, envoi };
      setMsgs(m => [...m, error]);
      reagir("error");
    } finally {
      if (request.current === controller) {
        request.current = null;
        setPending(false);
      }
    }
  };

  const onSend = (message: string, files?: File[]) => {
    if (request.current) return;
    follow.current = true;
    const extra = files?.length ? ` (${files.length} image jointe)` : "";
    const sent: Message = { id: ++id.current, role: "moi", texte: message + extra };
    if (repondre) {
      const historique: Historique = msgs.filter(m => m.role === "moi" || m.role === "zvi")
        .slice(-6).map(m => ({ role: m.role === "moi" ? "user" : "assistant", content: m.texte.slice(0, 1500) }));
      setMsgs(m => [...m, sent]);
      void demander({ texte: message, fichiers: files, historique });
    } else {
      const note: Message = { id: ++id.current, role: "note", texte: "Zvi n'est pas encore branché : ton message n'est parti nulle part." };
      setMsgs(m => [...m, sent, note]);
      reagir("error");
    }
  };

  const expression = open ? (pending ? "waiting" : reaction) : "idle";
  const personnage = { orbe: reglages.orbe, accent, expression };

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
          <Personnage size={36} {...personnage} />
          <div className="min-w-0 flex-1">
            <h2 id="renzvi-chat-titre" className="text-[15px] font-semibold leading-5">Zvi</h2>
            <p id="renzvi-chat-statut" role="status" className="text-[13px] leading-[18px] text-[var(--chat-muted)]">
              {pending ? "Réponse en cours…" : repondre ? "" : "Pas encore branché"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPerso(v => !v)}
            aria-label="Personnaliser le chat"
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
              <Personnage size={64} {...personnage} />
              <p className="text-[15px] font-semibold">Aucun message pour l’instant.</p>
              {!repondre && <p className="text-sm leading-relaxed text-[var(--chat-muted)]">Zvi n'est pas encore branché : tu peux écrire, mais personne ne répondra pour le moment.</p>}
            </div>
          ) : (
            <ol className="flex flex-col gap-3">
              {msgs.map(m => m.role === "moi" ? (
                <li key={m.id} className="max-w-[85%] self-end whitespace-pre-wrap break-words rounded-2xl bg-[var(--chat-bubble)] px-3.5 py-2 text-[15px] leading-normal">{m.texte}</li>
              ) : m.role === "zvi" ? (
                <li key={m.id} className="max-w-[85%] self-start whitespace-pre-wrap break-words px-3.5 py-2 text-[15px] leading-normal">{m.texte}</li>
              ) : m.role === "erreur" ? (
                <li key={m.id} className="max-w-[85%] self-start text-[13px] leading-snug text-[var(--chat-error)]">
                  <p>{m.texte}</p>
                  <button type="button" className="min-h-11 underline disabled:opacity-50" disabled={pending} onClick={() => void demander(m.envoi, m.id)}>Réessayer</button>
                </li>
              ) : (
                <li key={m.id} className="max-w-[85%] self-end text-right text-[13px] leading-snug text-[var(--chat-error)]">{m.texte}</li>
              ))}
            </ol>
          )}
        </div>

        <div className="chat-ia-compose px-3 pb-3">
          <PromptInputBox onSend={onSend} isLoading={pending} onCancel={annuler} placeholder="Écris ton message…" />
        </div>
      </div>

      <button
        ref={launch}
        type="button"
        onClick={() => toggle(!open)}
        aria-label={open ? "Fermer Zvi" : "Ouvrir Zvi"}
        aria-expanded={open}
        aria-controls="renzvi-chat-panel"
        className={`chat-ia-launch grid place-items-center rounded-full shadow-[0_6px_20px_rgba(23,25,28,0.22)] ${open ? "bg-[var(--paper,#fff)] text-[var(--ink,#1F2023)] ring-1 ring-black/5" : ""}`}
      >
        {open ? <X className="h-5 w-5" /> : <Personnage size={52} {...personnage} />}
      </button>
    </>
  );
}
