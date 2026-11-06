# Mémoire du projet Renzvi

**Passation pour le prochain Claude. État vérifié le 6 novembre 2026, au commit `b4c256b`.**

Lis ce fichier en entier avant de travailler, puis `CLAUDE.md` (règles) et `IDEES.md` (idées). Si ce fichier contredit le code ou GitHub, le code et GitHub ont raison : corrige alors ce fichier.

> ⚠️ **Ce repo est public.** N'écris jamais ici de clé, de mot de passe, d'adresse email ni de donnée d'utilisateur.

## 1. En 30 secondes

- **Le produit :** Renzvi, une seule app qui réunit tous les widgets du quotidien (study, chill, plus tard sport) sur un dashboard personnel qu'on compose comme un moodboard.
- **Le fondateur :** Damien, non technique, pilote tout en français, en langage naturel.
- **Où on en est :** le dashboard fonctionne (15 widgets, modes Study et Chill, pages personnelles, connexion). Il est en ligne et **gratuit**.
- **Ce qui bloque les premiers euros :** Damien n'a pas encore décidé ce qui est payant ni le prix. Le paiement Whop n'est pas branché et les pages légales n'existent pas.
- **Ta prochaine action :** voir la section 6. Commence par `git fetch origin`.

## 2. Comment travailler avec Damien

Les règles complètes sont dans `CLAUDE.md`. Voici l'essentiel, avec ce que l'expérience a ajouté :

- **Réponds en français simple.** Pour un choix technique, donne la conséquence concrète (coût, délai, risque), pas un cours.
- **Critique avant de construire.** Propose, critique franchement, contredis si l'idée est mauvaise, puis attends sa décision. Sur un ancien projet, Claude validait tout, puis de mauvais avis sont arrivés juste après : plus jamais de validation polie.
- **Vise les premiers euros.** Dis-le quand une demande ne rapproche pas de la vente.
- **Teste avant de dire « fini »** (lancer, capture) et dis honnêtement ce qui ne marche pas ou ce que tu n'as pas pu tester.
- **Pousse seulement quand Damien dit « commit push »,** directement sur `main`, avec exactement `git push origin main`. Pas de PR. Commits petits, en français.
- **Commence chaque tâche par `git fetch origin`.** Damien et Codex poussent sur `main` depuis ailleurs. Un fichier « introuvable » peut être dans un commit pas encore récupéré. S'il n'y a pas de conflit : `git pull --ff-only`.
- **Pas de dépense cachée.** Avant toute API payante : coût par utilisateur, chaque appel compté et plafonné par utilisateur.
- **Aucun secret dans le code ou le chat.** Indique à Damien quelle variable d'environnement remplir et où.
- **Qui fait quoi (depuis le 4 nov.) :** Damien donne les idées, Codex (connecté au repo) écrit les prompts, Claude Code construit. Un prompt de Codex collé par Damien vaut un brief de Damien, mais lis le code et reste critique. S'il contredit une décision de Damien, signale-le au lieu de l'appliquer. Kimi tenait ce rôle juste avant, sans voir le code.
- **Ses messages :** Damien écrit souvent vite et sans accents (« commit push », « dasgboard »). Comprends l'intention, et demande seulement si ça change vraiment ce que tu vas faire.

## 3. Le produit et les décisions

### Le message
- **On vend l'app entière et le fait de tout avoir au même endroit.** Aucune fonctionnalité n'est la star. Damien a corrigé Claude quand une landing mettait le ticket en avant : « on fait plein de feature donc pourquoi t'as mis le ticket en avant, faut parler de l'appli ».
- Le ticket et le vol vont dans la vitrine des widgets, jamais en titre.
- Rester honnête : ce qui n'existe pas encore reste marqué « bientôt ».

### Décisions de Damien, à ne pas remettre en cause sans sa demande

| Date | Décision |
|---|---|
| 2 nov. | Dashboard en glassmorphism clair, avec des variables CSS pour pouvoir changer de style (`CLAUDE.md` §3) |
| 3 nov. | **Logo validé, à garder tel quel** : « le logo est excellent j'adore on le garde » (détails ci-dessous) |
| 3 nov. | **V1 = deux modes, Study et Chill.** Sport après (V1.5 : minuteur d'intervalles + 3-4 programmes en texte) |
| 3 nov. | Un mode = un préréglage en un clic : fond + widgets + ambiance sonore + playlist |
| 3 nov. | Musique : lecteur Spotify intégré et alternative YouTube. Connexion Spotify complète plus tard, après vérification de leurs règles |
| 3 nov. | Fond blanc et design premium type Apple « pour l'instant », appliqué au login (inspiration, jamais copie) |
| 4 nov. | **Fonctionnalités d'abord, design ensuite.** Ne pas polir ni proposer de refonte, sauf si c'est illisible ou cassé. Tout le design sera refait après. Garder les styles en variables CSS |
| 4 nov. | **Vol : une seule ambiance, le hublot, compteur en bas.** « on fait pas la map 3D juste l'ambiance hublot ». Pas de carte, pas d'avion qui avance, pas de choix d'ambiance. FocusFlight est une inspiration, jamais une copie |
| 5 nov. | « fait en sorte que le /prototype sois le site de base » : fait (commit `c2b7e64`). Le nouvel argumentaire n'y est pas encore (section 5) |
| 6 nov. | Priorité au dashboard, les images de la landing attendent. Modes et temps de focus construits et poussés |

### Vol de focus : le piège à éviter
Un site ne peut pas bloquer un téléphone. **N'écris jamais que ça verrouille le téléphone.** La règle retenue : le vol est annulé si on quitte l'onglet ou l'appli avant l'arrivée. Un vrai blocage demanderait une app native (App Store 99 $/an, autorisation spéciale d'Apple), donc plus tard, si ça prend.

### Le logo
SVG viewBox 24×24, 4 carrés 9×9 à coins arrondis `rx=3` en grille 2×2 (x/y = 2 et 13). Celui en haut à gauche est plein, les 3 autres atténués. À côté, « Renzvi » en Instrument Sans 600.
- Sur fond photo ou sombre : blanc plein + 3 blancs à opacité .45.
- Sur fond clair : haut-gauche en accent `#1b6e66`, les 3 autres `#1f201d` à opacité .25.

### Pas encore décidé
- **Cible :** reco actuelle, étudiants et jeunes qui bossent. Alternative : freelances. À confirmer.
- **Gratuit / Pro et prix.** Attention, trois chiffres coexistent, et aucun n'a été testé auprès de qui que ce soit :
  - `IDEES.md` : 2 à 4 €/mois, avec un Pro comprenant photos perso, tous les sons et statistiques détaillées ;
  - dernière reco de Claude à Damien : 3 €/mois TTC ;
  - landing : Pro 7,90 € TTC/mois ou 76 €/an, Pro IA 15,90 € TTC/mois ou 153 €/an, affichés comme des hypothèses.
- **Le « Pro IA » de la landing ne correspond à rien dans le produit :** il n'y a aucune IA aujourd'hui. À signaler quand les prix seront tranchés.
- **Essai :** envisagé, gratuit permanent limité + Pro avec 14 jours sans carte.
- **Grille du dashboard :** faut-il laisser un trou en fin de ligne quand on mélange des widgets Petit et Moyen ? La question n'a pas été tranchée à ma connaissance.
- **Style de la landing :** à trancher (`CLAUDE.md` §3).

## 4. État technique réel

### Ce qui tourne
- **En ligne :** https://renzvi-site.vercel.app (`/`, `/prototype.html`, `/login.html`, `/dashboard.html` répondent 200 le 6 nov., et le commit `b4c256b` y est bien). `renzvi.vercel.app` ne sert pas ce site.
- **GitHub :** `Zoykaiiiii/renzvi`, branche `main`, repo public.
- **Déploiement :** Vercel, réglé côté Vercel. Il n'y a ni `vercel.json` ni CI dans le repo.

### ⚠️ La stack réelle n'est pas celle de `CLAUDE.md`
`CLAUDE.md` prévoit Next.js. **Le site est en réalité en HTML/CSS/JS statique, sans build, avec Supabase appelé depuis le navigateur.** Aucune migration vers Next.js n'a été faite. Si le sujet revient, présente-le comme un choix avec coût et délai.

### Les fichiers

| Fichier | Rôle |
|---|---|
| `site/dashboard.html` | Tout le dashboard (environ 2 700 lignes). Catalogue `WIDGETS` et `MODES` dedans |
| `site/login.html` | Connexion Google et code email, via Supabase |
| `site/index.html` | Accueil en ligne : ancien texte « ton espace de widgets » |
| `site/prototype.html` | Nouveau texte « Tes outils, au même endroit » (`data-landing="next"`, `noindex`) |
| `site/landing.js`, `landing.css` | Partagés par les deux landings, avec le marqueur `NEXT` |
| `site/lockin.js` | Scène du vol (hublot, WebGL) |
| `site/install.js`, `install.css`, `manifest.webmanifest`, `sw.js` | Installation de l'app. `sw.js` ne met volontairement rien en cache |
| `supabase/migrations/` | 7 migrations |
| `tests/*.check.cjs` | 4 suites de tests dans un vrai Chromium |
| `maquette/` | Ancienne maquette |
| `IDEES.md` | Toutes les idées. **Rien n'y est décidé tant que ce n'est pas dans `CLAUDE.md`** |
| `HISTORIQUE_PROJETS.md` | Les autres projets de Damien (NoBR, Dating Photo AI) et ses leçons. Certaines références à `CLAUDE.md` sont périmées |
| `.github/copilot-instructions.md` | Généré par le plugin claude-mem, à ignorer |
| `.taste-skill/` | Fichiers de travail du skill design. **Ne jamais les commiter** |

### Les 15 widgets
Vol de focus, Tâches, Heure, Minuteur focus, Temps de focus, Notes, Habitudes, Respiration guidée, Ambiance sonore, Compte à rebours, Mes raccourcis, Playlist, Pause détente, Suivi de lecture, Tableau d'inspiration.

- **Mode Study :** Vol, Minuteur, Tâches, Temps de focus, Notes, Compte à rebours. Garde le fond choisi au départ.
- **Mode Chill :** Respiration, Ambiance, Lecture, Playlist, Pause, Inspiration. Fond : le lac.
- **Aussi en place :** premier lancement, fonds d'écran, photo perso, personnalisation (verre, accent, déplacement, tailles), pages créées par l'utilisateur, parrainage, guide d'installation.
- **Playlist :** le lecteur ne se charge qu'après un clic, pour le consentement. Seuls le fournisseur, le type et l'identifiant du lien sont gardés.

### Ajouter un widget
Ajoute une entrée dans `WIDGETS` (`site/dashboard.html`). **S'il enregistre des données, ajoute aussi son identifiant à la contrainte `widget_state_widget_check`, via une migration.** Sinon, l'enregistrement échoue en boucle (« Pas encore enregistré. Nouvel essai… »). Heure, Temps de focus, Respiration et Pause n'enregistrent rien, donc ils n'y sont pas.

### Supabase
- **Projet :** `xjkmztfsyyccveaeyzov`, nommé « Zoykaiiiii's Project », organisation gratuite, Irlande, créé le 3 nov. **C'est bien celui de Renzvi, malgré son nom.** Cette confusion a déjà fait dire à tort à Damien que le projet n'existait pas. `Vintage.ai` est un autre sujet.
- **Tables :** `widget_state` (2 lignes le 6 nov.), `referral_codes` et `referrals` (vides). Sécurité par ligne (RLS) activée sur les trois.
- **Stockage :** `fonds` (3 Mo max) et `inspiration` (512 Ko max), privés.
- **Piège :** l'historique Supabase ne liste que 3 migrations sur 7, mais j'ai vérifié que la contrainte et le bucket `inspiration` des migrations suivantes sont bien en base. **Tout est donc appliqué : ne rejoue pas les 4 autres sans regarder.**
- **La clé dans `login.html` et `dashboard.html` est la clé publique,** prévue pour le navigateur. La sécurité repose sur la RLS. Aucune clé secrète dans le repo (recherche faite le 6 nov.) et pas de `.env`.

### Lancer les tests
Le 6 nov., au commit `b4c256b`, **les 4 suites passent** : `install`, `login`, `personnalisation`, `landing`.

```bash
# Dans ce Codespace
export NODE_PATH=$(dirname "$(ls -d ~/.npm/_npx/*/node_modules/playwright | tail -1)")
for t in install login personnalisation landing; do node tests/$t.check.cjs; done

# Sur une nouvelle machine
npm i --prefix ~/pw playwright@1.56.1 && npx --prefix ~/pw playwright install chromium
export NODE_PATH=~/pw/node_modules
```

**Limite importante :** ces tests utilisent une base Supabase simulée. Ils ne prouvent pas que tout marche sur un vrai compte.

### Inspecteur du skill design dans ce Codespace
Sans carte graphique, `scripts/inspect.mjs` plante sur la landing (`Page.captureScreenshot: Internal error`) à cause du WebGL de la scène du vol. Solution sans modifier le skill : ajouter `--use-angle=swiftshader --use-gl=angle` aux options de Chromium, via `node --import <préchargement>` qui enveloppe `Browser.launch` de `lib/cdp.mjs`, et `CHROME_PATH=~/.cache/ms-playwright/chromium-1194/chrome-linux/chrome`.

Dernier résultat sur `prototype.html` : 1 erreur et 6 alertes (dégradé, verre, cartes répétées, pas de vraie photo). Sur le dashboard : 0 erreur et 2 alertes, sur une copie figée des pages. Rien de cela n'a été corrigé, et le design sera refait après.

## 5. Ce qui marche, ce qui ne marche pas

**Vérifié :**
- Les 4 suites de tests passent, et le site en ligne contient le dernier commit.
- La connexion Google marche d'après Damien. Dans les navigateurs TikTok et Instagram, le bouton Google est masqué au profit du code email, avec un message pour ouvrir Safari ou Chrome.

**Pas vérifié :**
- **Modes Study/Chill sur un vrai compte.** Damien a dit le 6 nov. « je vais check » et je n'ai pas eu son retour. **Demande-lui.**
- Vraie musique sur une page masquée.
- Limites d'envoi des emails de connexion par Supabase. À contrôler avant le lancement, car un SMTP dédié peut être nécessaire.

**Manque ou imparfait :**
- **Paiement :** aucune trace de Whop dans `site/`. Aucune limite gratuit/Pro. Le menu du compte dit « Renzvi est gratuit pour l'instant ».
- **Légal :** mentions légales et confidentialité sont « en préparation ». **Indispensables avant le premier euro.**
- **Accueil :** il affiche encore l'ancien texte. Le nouveau est sur `prototype.html`, et il a été commité (`e0a59e9`).
- **Images de la landing :** trop petites (736 px au mieux, `chat.webp` à 597 px) et **droits non vérifiés**, c'est un risque juridique une fois le site en vente. 736 px évoque Pinterest, mais ce n'est qu'une supposition. Reco faite à Damien : photos libres de droits (gratuit, environ 30 min), ou ses originaux en 1920 px, si les droits le permettent. Pas encore choisi. Les fonds du dashboard ont leurs sources dans `site/assets/credits.json`, et certaines licences exigent de citer l'auteur.
- **Modes incomplets par rapport à la décision du 3 nov. :** cliquer sur un mode ne lance ni son ni playlist. Un widget ne peut être que sur une page, donc Study n'a ni musique ni ambiance. Reco déjà donnée : pas de lancement automatique du son.
- **Pas de retour arrière** après « Installer Study et Chill ». Supprimer une page déplace ses widgets sur une page voisine.
- **Temps de focus :** seul le dernier jour déjà enregistré est repris, donc le total peut sembler bas au début.
- **Une seule photo perso par compte,** même si plusieurs pages l'utilisent.
- **Widgets vides de Chill :** ils laissent des blancs, surtout Lecture. Laissé tel quel, puisque le design sera refait.
- **`.taste-skill/` n'est pas ignoré :** il n'y a pas de `.gitignore`, donc n'utilise jamais `git add -A` ou `git add .`.

## 6. Prochaines étapes

Ordre recommandé à Damien le 6 nov. **Pas encore validé par Damien.**

1. **Récupérer son retour** sur les modes testés sur son vrai compte, et corriger ce qui cloche.
2. **Lui faire trancher gratuit/Pro et le prix TTC.** Tout le reste en dépend. Reco : photos perso, tous les sons et statistiques détaillées en Pro, à 3 €/mois TTC. Sois clair que ce prix n'est pas testé.
3. **Brancher Whop,** avec les prix réglés **TVA incluse** (sinon la TVA s'ajoute au paiement), et les limites du gratuit. Vois l'expérience Whop dans `HISTORIQUE_PROJETS.md`.
4. **Écrire mentions légales et confidentialité.** Fais-les relire : un modèle ne remplace pas un avis juridique.
5. **Passer « Tes outils, au même endroit » en accueil,** puis retirer le marqueur `NEXT` de `landing.js` et le `noindex`. Reco : oui, mais il faut l'accord de Damien.
6. **Remplacer les images de la landing** et mettre les prix affichés en cohérence avec sa décision.
7. **Après les premières ventes :** son et playlist par mode, carnet de voyages et choix de destination, hydratation, sport, fiches de révision, vol de groupe.
8. **Refonte du design :** prévue par Damien une fois les fonctionnalités finies. Reco : après le paiement, pas avant.

**Déconseillé pour l'instant :** ajouter d'autres widgets (il y en a déjà 15 et ça ne rapproche pas de la vente), calories et poids (chacun est une app entière), fiches par IA (coût par utilisateur à calculer avant de construire).

## 7. Règles légales à ne jamais oublier

- Pas de fausses stats, faux avis, faux compteurs, faux prix barrés (loi française). Prix affichés **TTC**.
- RGPD : données privées par défaut, collecter le minimum.
- Respiration et bien-être : un outil de détente, **aucune promesse médicale**.
- Ne jamais copier un concurrent (liquidjournal.app et FocusFlight sont des inspirations, pas des modèles).

## 8. Les outils que le prochain Claude doit avoir

### Indispensables

| Outil | Pourquoi | Comment l'avoir |
|---|---|---|
| **`design-taste-frontend`** | **Obligatoire pour tout écran** (`CLAUDE.md` §3) | Déjà dans le repo (`.claude/skills/`). Source : `Leonxlnx/taste-skill`. Node 22+ et Chrome/Chromium requis |
| `security-and-hardening` | Connexion, données, paiement | Déjà dans le repo |
| `shipping-and-launch` | Avant le lancement | Déjà dans le repo |
| **Connecteur Supabase** | Lire la base et appliquer les migrations | À connecter sur claude.ai, avec le compte de Damien |
| **Playwright 1.56.1 + Chromium** | Lancer les tests et faire les captures | Voir « Lancer les tests » |
| **`gh` et accès GitHub** | Pousser sur `main` | Compte qui a accès à `Zoykaiiiii/renzvi` |

### Plugins installés dans ce Codespace

| Plugin | Version | Rôle | Installation |
|---|---|---|---|
| **claude-mem** | 15.10.1 | Mémoire entre les sessions | `claude plugin marketplace add thedotmack/claude-mem` puis `claude plugin install claude-mem@thedotmack` |
| **ponytail** | 5.3.3 | Faire la solution la plus simple, audits et revues | `claude plugin marketplace add DietrichGebert/ponytail` puis `claude plugin install ponytail@ponytail` |
| design | 1.2.0 | Critique, accessibilité, textes d'interface | Synchronisé depuis claude.ai, avec le même compte |
| engineering | 1.2.0 | Revue, débogage, tests, déploiement | Synchronisé depuis claude.ai |
| marketing | 1.2.0 | Contenu, SEO, campagnes | Synchronisé depuis claude.ai |
| postiz | 2.0.25 | Programmer des posts sur les réseaux | Synchronisé depuis claude.ai |

**Optionnel :** skill `agent-reach` (lire des plateformes comme Reddit ou YouTube, installé dans `~/.agents/skills`, source non retrouvée).

**Connecteurs aussi présents, inutiles pour Renzvi aujourd'hui :** Claude Docs, Canva, Framer, ForgeGUI, Vibe Prospecting, Replit. **Attention, Replit et ForgeGUI peuvent coûter de l'argent :** passer par le connecteur Replit a déjà déclenché le mode Power payant sur un autre projet. Demande toujours avant. Similarweb ne se connectait pas le 6 nov.

### Variables et secrets
Aucune variable d'environnement n'est utilisée pour l'instant. Whop en demandera : ne les écris jamais dans le code. Indique à Damien leur nom et où les remplir.

## 9. Ce que ce fichier ne transporte pas

- **La mémoire de Claude reste dans le Codespace :** `~/.claude/projects/-workspaces-renzvi/memory/` et la base de claude-mem (`~/.claude-mem/`). Si le Codespace est supprimé, seul ce qui est dans le repo survit. Ce fichier en reprend l'essentiel. Le détail de chaque essai technique et l'historique des conversations ne s'y trouvent pas.
- **Les captures d'écran de travail** étaient dans un dossier temporaire : considère-les comme perdues.
- **Sur un autre compte Claude,** les plugins synchronisés et les connecteurs n'existeront pas : il faudra les réinstaller.
- **Note périmée dans claude-mem :** la tâche `landing-argumentaire` dit « non commité ». C'est faux depuis `e0a59e9`. D'autres notes parlent de « landing v3 » ou d'un dashboard « à trancher » : le dashboard blanc en verre existe depuis `ffd1453`, et l'accueil a été remplacé par `c2b7e64`.

## 10. Historique des commits importants

| Commit | Ce qui a changé |
|---|---|
| `b4c256b` | Modes Study et Chill, temps de focus de la semaine (dernier commit produit) |
| `e0a59e9` | Prototype : argumentaire « Tes outils, au même endroit » et nouveaux fonds |
| `c2b7e64` | Le prototype devient la page d'accueil |
| `f210e14` | Pages du dashboard : créer, renommer, supprimer |
| `f27fad3` | Personnalisation : verre, accent, déplacement, tailles |
| `e481af7` | Landing Encre et démonstration du vol |
| `7ba887f`, `02fd77e`, `ff5f75d` | Widgets détente, lecture, inspiration, playlist, ambiance |
| `2b0e8ab` | Installation de l'app : manifeste, icônes, guide animé |
| `04ae36e`, `c32aa9c` | Vol de focus : ticket déchiré et hublot |
| `f4d27ad`, `ffd1453` | Dashboard blanc en verre, widgets, fonds, parrainage |
| `79879bb` | Page de connexion |

## 11. Les autres projets de Damien

Détails dans `HISTORIQUE_PROJETS.md`. Ne les mélange pas avec Renzvi.

- **NoBR :** son projet en lancement au 2 nov., avec une règle de décision au 30 novembre.
- **Dating Photo AI :** en ligne.
- **SaaS « histoire → vidéo verticale » :** un autre projet, pour plus tard.
