import FontCycle from "@/components/FontCycle";
import Magnet from "@/components/Magnet";
import Motion from "@/components/Motion";
import { Logo, Slot } from "@/components/Bits";
import { BoardSwap, ToolsOrbit } from "@/components/Showcase";

const LOGIN = "/login.html";

const NAV = [
  ["#outils", "Outils"],
  ["#dashboards", "Dashboards"],
  ["#modes", "Study et Chill"],
  ["#offres", "Offres"],
  ["#questions", "Questions"],
];

// Les quatre carrés du logo : un plein, trois en attente qui se remplissent au défilement.
const SQUARES = [
  { name: "Tâches", sample: "Relire le chapitre 4", bg: "#242424", light: true },
  { name: "Notes", sample: "Exposé jeudi : revoir l'intro", bg: "#d9cdbd" },
  { name: "Minuteur", sample: "18:42", bg: "#ffffff" },
  { name: "Playlist", sample: "Pluie douce et piano", bg: "#615d59", light: true },
];

const STEPS = [
  ["D'abord Study, pour bosser.", "Ton cours au centre, flashcards, minuteur et tâches autour."],
  ["Puis Chill, pour souffler.", "Ta musique, ton ambiance sonore et ta lecture en cours."],
  ["Et tu passes de l'un à l'autre.", "Chaque mode garde ses widgets et son fond. Rien à refaire."],
];

const PLANS = [
  { name: "Gratuit", price: "0 €", note: "Pour réunir tes outils et t'en servir chaque jour.", lines: ["Un espace avec une sélection de widgets", "Fonds d'écran au choix", "Limites exactes encore à confirmer"] },
  { name: "Pro", price: "7,90 € TTC par mois", note: "ou 76 € TTC par an. Pas encore en vente.", lines: ["Plusieurs espaces enregistrés : Study, Chill et les tiens", "Tous les widgets classiques", "Personnalisation complète : fonds, photo perso, disposition"] },
  { name: "Pro IA", price: "15,90 € TTC par mois", note: "ou 153 € TTC par an. Pas encore en vente.", lines: ["Tout le Pro", "Des outils pour réviser à partir de tes cours, avec l'IA", "Un quota d'utilisation, précisé avant le lancement"] },
];

const FAQ = [
  ["C'est quoi, Renzvi ?", "Un espace personnel qui réunit tes outils du quotidien : tâches, notes, minuteur, musique, ambiance. Tu les ranges comme un moodboard, sur le fond de ton choix."],
  ["Est-ce que ça remplace mes applis ?", "Non. Renzvi garde sous tes yeux ce que tu utilises tout le temps. Tes applis plus complètes restent là quand tu en as besoin, et le widget Playlist lit tes liens Spotify ou YouTube."],
  ["Qu'est-ce que je peux personnaliser ?", "Le fond d'écran ou ta propre photo, la couleur d'accent, l'effet verre, la place et la taille de chaque widget, et tes pages."],
  ["Sur quels appareils ?", "Dans ton navigateur, sur ordinateur, tablette et téléphone. Tu peux aussi l'installer sur ton écran d'accueil. Depuis TikTok ou Instagram, ouvre d'abord le lien dans Safari ou Chrome."],
  ["Comment je me connecte ?", "Avec ton compte Google, ou avec un code à usage unique envoyé par email. Pas de mot de passe à retenir."],
  ["Qui voit mes données ?", "Toi seul. Ton espace est privé par défaut et on ne garde que le nécessaire pour le faire fonctionner : ton email et le contenu de tes widgets."],
  ["Combien ça coûte ?", "Renzvi est gratuit aujourd'hui. Les offres Pro et Pro IA sont envisagées, avec des prix TTC ; rien n'est vendu tant que le lancement n'est pas annoncé."],
];

export default function Page() {
  return (
    <>
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white">Aller au contenu</a>

      <header className="nav-glass fixed inset-x-0 top-0 z-40">
        <div className="flex h-16 items-center gap-6 px-[var(--m)]">
          <a href="#top" className="flex min-h-11 items-center gap-2.5 text-lg font-semibold" aria-label="Renzvi, haut de page"><Logo className="size-6" />Renzvi</a>
          <nav aria-label="Sections de la page" className="hidden gap-1 lg:flex">
            {NAV.map(([href, label]) => <a key={href} href={href} className="flex h-9 items-center rounded-full px-3 font-medium hover:bg-lin">{label}</a>)}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <a href={LOGIN} className="hidden h-11 items-center rounded-full px-3 font-medium hover:bg-lin sm:flex">Connexion</a>
            <a href={LOGIN} className="btn btn-ink !min-h-10 !px-4">Créer mon espace</a>
          </div>
        </div>
      </header>

      <Motion>
        <main id="contenu">
          {/* Héros, épinglé : la carte à gauche, les quatre carrés du logo à droite. */}
          <section id="top" data-hero className="grid min-h-svh gap-3 px-[var(--m)] pb-[var(--m)] pt-20 lg:grid-cols-2">
            <div className="flex flex-col justify-between gap-10 rounded-box bg-card p-6 sm:p-10 lg:p-14">
              <h1 data-split>Tes outils, au<br />même endroit</h1>
              <div className="flex flex-col gap-8">
                <div data-rise><FontCycle>Et tout se règle à ton goût.</FontCycle></div>
                <p data-rise className="max-w-[44ch]">Renzvi réunit tâches, notes, minuteur et musique sur un dashboard que tu composes comme un moodboard&nbsp;: ton fond, tes couleurs, tes widgets.</p>
                <div data-rise className="flex flex-wrap items-center gap-3">
                  <Magnet padding={70} magnetStrength={3}><a href={LOGIN} className="btn btn-ink">Créer mon espace</a></Magnet>
                  <a href="#outils" className="btn btn-soft">Voir comment ça marche</a>
                </div>
              </div>
            </div>
            <div className="grid place-items-center rounded-box bg-lin p-6">
              <div data-squares className="grid aspect-square w-[min(100%,68svh)] grid-cols-2 gap-[4%]" role="img" aria-label="Le logo de Renzvi, quatre carrés : chacun contient un outil, Tâches, Notes, Minuteur et Playlist.">
                {SQUARES.map((s, i) => (
                  <div key={s.name} data-sq={i ? "wait" : "full"} data-bg={s.bg} aria-hidden="true"
                    className={`sq flex flex-col justify-end gap-1 p-[12%] ${s.light ? "text-white" : ""}`} style={{ backgroundColor: s.bg }}>
                    <span className="text-statement font-semibold leading-none">{s.name}</span>
                    <span className="text-small">{s.sample}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Les outils : pleine largeur, l'orbite autour du logo. */}
          <section id="outils" className="px-[var(--m)] pt-32 lg:pt-48">
            <div className="grid gap-6 lg:grid-cols-2">
              <h2 data-split>Tout gravite autour<br />d'un seul écran</h2>
              <p data-rise className="max-w-[46ch] lg:pt-3">Ta liste dans une fenêtre, tes notes dans une autre, le minuteur à retrouver, la musique ailleurs. Dans Renzvi, ce sont des widgets posés côte à côte. Attrape une tuile pour faire tourner l'orbite.</p>
            </div>
            <div data-rise className="mt-10 overflow-hidden rounded-box bg-lin py-10 lg:mt-16 lg:py-20">
              <ToolsOrbit />
            </div>
          </section>

          {/* Les dashboards : champ sombre, les cartes qui se relaient. */}
          <section id="dashboards" className="mx-[var(--m)] mt-32 grid items-center gap-10 overflow-hidden rounded-box bg-night p-6 text-white sm:p-10 lg:mt-48 lg:min-h-[86svh] lg:grid-cols-2 lg:p-14">
            <div className="flex flex-col gap-6 self-start lg:self-center">
              <h2 data-split>Même app, jamais<br />le même écran</h2>
              <p data-rise className="max-w-[44ch]">Deux personnes, deux dashboards. Tu choisis le fond ou ta propre photo, la couleur d'accent, la taille et la place de chaque widget. Tu retrouves ton espace tel que tu l'as laissé.</p>
              <div data-rise><a href={LOGIN} className="btn btn-paper">Composer le mien</a></div>
            </div>
            <div data-rise className="relative h-[340px] sm:h-[460px] lg:h-[560px]">
              <BoardSwap />
            </div>
          </section>

          {/* Study et Chill : l'illustration reste en place, son état change. */}
          <section id="modes" data-modes className="px-[var(--m)] pt-32 lg:pt-48">
            <h2 data-split className="lg:max-w-[50%]">Study pour bosser.<br />Chill pour souffler.</h2>
            <div className="mt-8 grid gap-x-3 lg:mt-0 lg:grid-cols-2">
              <div data-stage className="z-10 self-start bg-paper pb-3 lg:order-2 lg:bg-transparent lg:pb-0">
                <div className="relative h-[42svh] lg:h-[calc(100svh-128px)]">
                  <div data-state className="absolute inset-0"><Slot label="dashboard en mode Study" tone="card" /></div>
                  <div data-state className="absolute inset-0"><Slot label="dashboard en mode Chill" tone="sable" /></div>
                  <div data-state className="absolute inset-0"><Slot label="passage de Study à Chill" tone="ink" /></div>
                </div>
              </div>
              <ol className="lg:order-1">
                {STEPS.map(([title, text], i) => (
                  <li key={title} data-step className={`flex min-h-[60svh] flex-col justify-center gap-3 transition-colors duration-500 lg:min-h-[80svh] ${i ? "text-soft" : ""}`}>
                    <p className="max-w-[20ch] text-statement font-semibold leading-tight">{title}</p>
                    <p className="max-w-[40ch]">{text}</p>
                  </li>
                ))}
              </ol>
            </div>
            <p className="max-w-[46ch] pt-6">D'autres moments pourront suivre, comme le sport ou la création. Ils ne sont pas encore là.</p>
          </section>

          {/* Offres, comme une carte de café. */}
          <section id="offres" className="grid gap-10 px-[var(--m)] pt-32 lg:grid-cols-12 lg:pt-48">
            <div className="flex flex-col gap-5 lg:col-span-4">
              <h2 data-split>Gratuit pour<br />commencer</h2>
              <p data-rise className="max-w-[36ch]">Offres envisagées&nbsp;: ces prix sont des hypothèses. Aucun abonnement n'est vendu aujourd'hui et rien ne t'est facturé.</p>
              <div data-rise><a href={LOGIN} className="btn btn-ink">Créer mon espace</a></div>
            </div>
            <div className="grid gap-3 lg:col-span-8 lg:grid-cols-3">
              {PLANS.map((p, i) => (
                <article key={p.name} data-rise className={`flex flex-col gap-4 rounded-box p-6 lg:p-8 ${["bg-card", "bg-sable", "bg-lin"][i]}`}>
                  <h3 className="text-statement font-semibold leading-none">{p.name}</h3>
                  <p><span className="font-semibold tabular-nums">{p.price}</span><br /><span className="text-small">{p.note}</span></p>
                  <ul className="flex flex-col gap-2.5 pt-2">{p.lines.map((l) => <li key={l}>{l}</li>)}</ul>
                </article>
              ))}
            </div>
          </section>

          {/* Questions : une ligne déroulante par question (demande de Damien, 13 nov.). */}
          <section id="questions" className="grid gap-10 px-[var(--m)] pt-32 lg:grid-cols-12 lg:pt-48">
            <h2 data-split className="lg:col-span-4">Questions<br />fréquentes</h2>
            <div data-rise className="flex flex-col gap-2 lg:col-span-8">
              {FAQ.map(([q, a], n) => (
                <details key={q} name="faq" open={n === 0} className="faq rounded-box bg-card">
                  <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 px-6 py-4 font-semibold [&::-webkit-details-marker]:hidden">
                    {q}
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="faq-plus size-5 flex-none"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                  </summary>
                  <p className="max-w-[62ch] px-6 pb-6">{a}</p>
                </details>
              ))}
            </div>
          </section>

          <section aria-labelledby="fin" className="px-[var(--m)] pb-[18svh] pt-[26svh]">
            <h2 id="fin" data-split className="max-w-[18ch]">Réunis tes outils aujourd'hui</h2>
            <p data-rise className="max-w-[40ch] pt-6">Il te suffit de Google ou d'un code reçu par email. Ton espace t'attend tel que tu l'as laissé, à chaque retour.</p>
            <div data-rise className="pt-6"><Magnet padding={90} magnetStrength={3}><a href={LOGIN} className="btn btn-ink">Créer mon espace</a></Magnet></div>
          </section>
        </main>

        <footer className="grid gap-3 px-[var(--m)] pb-[var(--m)] lg:min-h-[80svh] lg:grid-cols-2">
          <div className="relative min-h-[40svh] overflow-hidden rounded-box bg-ink">
            <div data-drift className="absolute -bottom-[18%] -left-[10%] w-[92%] lg:w-[84%]"><Logo light className="w-full" /></div>
          </div>
          <div className="flex flex-col justify-between gap-12 rounded-box bg-card p-6 sm:p-10 lg:p-14">
            <nav aria-label="Pied de page" className="flex flex-col gap-3">
              {NAV.map(([href, label]) => <a key={href} href={href} className="w-fit text-title font-semibold leading-none tracking-tight transition-transform duration-300 [font-stretch:82%] hover:translate-x-3">{label}</a>)}
            </nav>
            <div className="flex flex-col gap-6 text-small">
              <p className="flex flex-wrap gap-x-5 gap-y-2 text-[1rem]">
                <a className="link" href={LOGIN}>Connexion</a>
                <a className="link" href="/legal.html#mentions">Mentions légales</a>
                <a className="link" href="/legal.html#cgv">CGV</a>
                <a className="link" href="/legal.html#confidentialite">Confidentialité</a>
              </p>
              <p>Prototype de présentation&nbsp;: les illustrations de dashboard arrivent, les offres payantes ne sont pas en vente. Polices Instrument Sans, Instrument Serif, Pixelify Sans, Playpen Sans, Unbounded, Gloock et Syne, licence SIL OFL. © 2026 Renzvi.</p>
            </div>
          </div>
        </footer>
      </Motion>
    </>
  );
}
