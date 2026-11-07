# Mémoire du projet Renzvi

**Passation pour le prochain Claude. État vérifié le 6 novembre 2026, au commit `b4c256b`.**

> **Complément de passation — Codex, 7 novembre 2026.** Les sections 1 à 11 conservent la mémoire du premier Claude Code/Codespace. Lire aussi la **section 12, signée Codex**, avant de choisir la prochaine tâche : elle consigne les échanges plus récents avec Damien, la priorité Study, le rôle de chacun et les sujets encore ouverts. Les vérifications du 6 novembre ci-dessous restent datées ; elles ne sont pas des tests réexécutés aujourd'hui.

Lis ce fichier en entier avant de travailler, puis `CLAUDE.md` (règles) et `IDEES.md` (idées). Si ce fichier contredit le code ou GitHub, le code et GitHub ont raison : corrige alors ce fichier.

> ⚠️ **Ce repo est public.** N'écris jamais ici de clé, de mot de passe, d'adresse email ni de donnée d'utilisateur.

## 1. En 30 secondes

- **Le produit :** Renzvi, une seule app qui réunit tous les widgets du quotidien (study, chill, plus tard sport) sur un dashboard personnel qu'on compose comme un moodboard.
- **Le fondateur :** Damien, non technique, pilote tout en français, en langage naturel.
- **Où on en est :** le dashboard fonctionne (15 widgets, modes Study et Chill, pages personnelles, connexion). Il est en ligne et **gratuit**.
- **Ce qui bloque les premiers euros :** Damien n'a pas encore décidé ce qui est payant ni le prix. Le paiement Whop n'est pas branché et les pages légales n'existent pas.
- **Ta prochaine action :** lire la section 12 et le backlog Study d'`IDEES.md`. La section 6 est l'ancien ordre recommandé, pas la priorité actuelle. Commence par `git fetch origin` et protège les modifications locales.

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
| 5 nov. | « fait en sorte que le /prototype sois le site de base » : fait (commit `c2b7e64`), complété le 6 nov. avec le nouvel argumentaire |
| 6 nov. | Priorité au dashboard, les images de la landing attendent. Modes et temps de focus construits et poussés |
| 6 nov. | « le bon site c'est prototype.html » : son contenu est devenu `site/index.html`, l'ancien accueil est supprimé. `/prototype.html` renvoie vers l'accueil. Le `noindex` et le bandeau « Prototype » restent en attendant le lancement |

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
- **Essai :** ancienne piste, gratuit permanent limité + Pro avec 14 jours sans carte. Les échanges avec Codex ont rouvert ce choix : gratuit avec crédits de découverte ou essai court, sans durée définitivement choisie ; voir section 12.
- **Grille du dashboard :** faut-il laisser un trou en fin de ligne quand on mélange des widgets Petit et Moyen ? La question n'a pas été tranchée à ma connaissance.
- **Style de la landing :** l'ancienne mention « à trancher » de `CLAUDE.md` est dépassée par le brief de Damien à Codex : palette Encre pour la landing, décrite en section 12. Ce choix ne remplace pas la personnalisation d'accent du dashboard.

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
| `site/index.html` | Accueil : « Tes outils, au même endroit » (`noindex`) |
| `site/prototype.html` | Redirige vers l'accueil, pour les liens déjà partagés |
| `site/landing.js`, `landing.css` | Scripts et styles de l'accueil |
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
# Sur une nouvelle machine, une seule fois
npm i --prefix ~/pw playwright@1.56.1 && npx --prefix ~/pw playwright install chromium
sudo npx --prefix ~/pw playwright install-deps chromium

# Pour lancer les tests
export NODE_PATH=~/pw/node_modules
for t in install login personnalisation landing; do node tests/$t.check.cjs; done
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
- **Images de la landing :** trop petites (736 px au mieux, `chat.webp` à 597 px) et **droits non vérifiés**, c'est un risque juridique une fois le site en vente. 736 px évoque Pinterest, mais ce n'est qu'une supposition. Reco faite à Damien : photos libres de droits (gratuit, environ 30 min), ou ses originaux en 1920 px, si les droits le permettent. Pas encore choisi. Les fonds du dashboard ont leurs sources dans `site/assets/credits.json`, et certaines licences exigent de citer l'auteur.
- **Modes incomplets par rapport à la décision du 3 nov. :** cliquer sur un mode ne lance ni son ni playlist. Un widget ne peut être que sur une page, donc Study n'a ni musique ni ambiance. Reco déjà donnée : pas de lancement automatique du son.
- **Pas de retour arrière** après « Installer Study et Chill ». Supprimer une page déplace ses widgets sur une page voisine.
- **Temps de focus :** seul le dernier jour déjà enregistré est repris, donc le total peut sembler bas au début.
- **Une seule photo perso par compte,** même si plusieurs pages l'utilisent.
- **Widgets vides de Chill :** ils laissent des blancs, surtout Lecture. Laissé tel quel, puisque le design sera refait.
- **`.taste-skill/` n'est pas ignoré :** il n'y a pas de `.gitignore`, donc n'utilise jamais `git add -A` ou `git add .`.

## 6. Prochaines étapes

Ordre historique recommandé à Damien le 6 nov. **Pas encore validé par Damien à cette date.** Conservé pour la passation du premier Claude ; la nouvelle priorité exprimée ensuite est Study, voir section 12. Ne pas lancer Whop ou une nouvelle refonte à la place du lot demandé par Damien.

1. **Récupérer son retour** sur les modes testés sur son vrai compte, et corriger ce qui cloche.
2. **Lui faire trancher gratuit/Pro et le prix TTC.** Tout le reste en dépend. Reco : photos perso, tous les sons et statistiques détaillées en Pro, à 3 €/mois TTC. Sois clair que ce prix n'est pas testé.
3. **Brancher Whop,** avec les prix réglés **TVA incluse** (sinon la TVA s'ajoute au paiement), et les limites du gratuit. Vois l'expérience Whop dans `HISTORIQUE_PROJETS.md`.
4. **Écrire mentions légales et confidentialité.** Fais-les relire : un modèle ne remplace pas un avis juridique.
5. **Au lancement,** retirer le `noindex` et le bandeau « Prototype » de l'accueil.
6. **Remplacer les images de la landing** et mettre les prix affichés en cohérence avec sa décision.
7. **Après les premières ventes :** son et playlist par mode, carnet de voyages et choix de destination, hydratation, sport, fiches de révision, vol de groupe.
8. **Refonte du design :** prévue par Damien une fois les fonctionnalités finies. Reco : après le paiement, pas avant.

**Ancienne recommandation de Claude :** déconseiller les nouveaux widgets, calories/poids et fiches IA. **Actualisation Codex :** Damien veut maintenant préparer le parcours Study. Calories/poids restent reportés et les coûts IA doivent toujours être mesurés ; ne pas utiliser cette ancienne recommandation pour ignorer son nouveau brief.

## 7. Règles légales à ne jamais oublier

- Pas de fausses stats, faux avis, faux compteurs, faux prix barrés (loi française). Prix affichés **TTC**.
- RGPD : données privées par défaut, collecter le minimum.
- Respiration et bien-être : un outil de détente, **aucune promesse médicale**.
- Ne jamais copier un concurrent (liquidjournal.app et FocusFlight sont des inspirations, pas des modèles).

## 8. Les outils que le prochain Claude doit avoir

### Indispensables

| Outil | Pourquoi | Comment l'avoir |
|---|---|---|
| **`design-taste-frontend`** | **Obligatoire pour tout écran** (`CLAUDE.md` §3) | Déjà dans le repo (`.claude/skills/`), en v2. Source : `Leonxlnx/taste-skill`. Node 22+ et Chrome/Chromium requis. **Ne pas passer en 2.5 sans l'accord de Damien :** cette version retire la partie écrans d'app et dashboards et pèse 40 Mo |
| `security-and-hardening` | Connexion, données, paiement | Déjà dans le repo |
| `shipping-and-launch` | Avant le lancement | Déjà dans le repo |
| **Connecteur Supabase** | Lire la base et appliquer les migrations | À connecter sur claude.ai, avec le compte de Damien |
| **Playwright 1.56.1 + Chromium** | Lancer les tests et faire les captures | Voir « Lancer les tests » |
| **`gh` et accès GitHub** | Pousser sur `main` | Compte qui a accès à `Zoykaiiiii/renzvi` |

### Plugins installés dans ce Codespace

| Plugin | Version | Rôle | Installation |
|---|---|---|---|
| **claude-mem** | 15.10.1 | Mémoire entre les sessions | `npm i -g bun` (requis), puis `claude plugin marketplace add thedotmack/claude-mem` et `claude plugin install claude-mem@thedotmack` |
| **ponytail** | 5.3.3 | Faire la solution la plus simple, audits et revues | `claude plugin marketplace add DietrichGebert/ponytail` puis `claude plugin install ponytail@ponytail` |
| **caveman** | 4.0.1 | Réponses très courtes pour économiser des tokens. S'active seul à chaque session, se coupe avec « stop caveman » | `claude plugin marketplace add JuliusBrussee/caveman` puis `claude plugin install caveman@caveman` |
| **agent-skills** (Addy Osmani) | 0.6.15 | 25 skills d'ingénierie : specs, tests, débogage, revue, mise en ligne | `claude plugin marketplace add addyosmani/agent-skills` puis `claude plugin install agent-skills@addy-agent-skills` |
| design | 1.2.0 | Critique, accessibilité, textes d'interface | `claude plugin install design@anthropic-plugin-directory` |
| engineering | 1.2.0 | Revue, débogage, tests, déploiement | `claude plugin install engineering@anthropic-plugin-directory` |
| marketing | 1.2.0 | Contenu, SEO, campagnes | `claude plugin install marketing@anthropic-plugin-directory` |
| postiz | 2.0.25 | Programmer des posts sur les réseaux | `claude plugin install postiz@claude-plugins-official` |

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

## 12. Passation Codex — échanges avec Damien jusqu'au 7 novembre 2026

**Auteur de cette section : Codex, assistant connecté au dépôt, chargé par Damien de compléter la mémoire du premier Claude.** Les faits de code s'appuient sur `main` au commit produit/documentation `3cb4997` et la mise à jour d'`IDEES.md` publiée dans `c0bd315`. Cette section est une transmission de contexte, pas le compte rendu d'une nouvelle implémentation Study.

### 12.1. Mon rôle et la répartition du travail

- **Damien** pilote le produit et tranche surtout le design et les usages. Il est non technique. Il souhaite des avis francs, y compris lorsqu'une idée est coûteuse ou prématurée ; pas de validation flatteuse ni de choix d'architecture à lui faire arbitrer sans raison.
- **Codex** lit le dépôt, vérifie `git status`/l'historique, analyse les propositions et les livraisons de Claude, structure les idées et rédige les prompts de réalisation. Il distingue faits vérifiés, hypothèses commerciales, recommandations et idées futures.
- **Claude Code** réalise les fonctionnalités, vérifie le code courant, teste et montre le résultat à Damien. Il garde son jugement technique ; un prompt n'est pas une invitation à appliquer aveuglément une hypothèse périmée.
- **Limite du rôle Codex :** ne pas modifier spontanément l'application en parallèle de Claude. Damien a explicitement demandé des exceptions : mise à jour de la documentation et intégration d'un ZIP livré par Claude. Cela ne donne pas une autorisation générale de développer tous les widgets du backlog.
- **Publication :** Damien a demandé les commits/pushs précédents. Cette autorisation n'est pas permanente : attendre un nouveau « commit push » pour publier une nouvelle tâche. Pousser directement sur `main`, sans PR, avec `git push origin main`, après les vérifications adaptées.
- Plusieurs assistants et comptes/environnements peuvent travailler sur ce repo. Toujours vérifier les changements distants ; ne pas écraser les fichiers, réinitialiser la branche ou importer aveuglément les copies d'un ZIP.

### 12.2. Ce que Codex a effectivement fait

- Lu et discuté le code avec Damien, préparé des prompts pour Claude Code local puis Claude Code cloud ; le Claude cloud ne possède pas automatiquement notre historique ou les fichiers locaux.
- Analysé les exports Refero/Notion fournis par Damien, puis les ZIP successifs du prototype. La palette bleue puis la palette prune ont été abandonnées au profit d'Encre.
- Ajouté les premières idées Codex à `IDEES.md`, publiées sur demande dans `7e65756`.
- Intégré le prototype Encre fourni en ZIP, avec ses fontes/images/scripts, sans écraser l'application déjà présente. Publication demandée par Damien : `e481af7`. À cette étape, le prototype était séparé de l'accueil.
- À cette intégration, vérifié localement les interactions à 320/390/768/1440 px, les ressources, les offres, le guide d'installation et le vol, avec animation complète/rejeu/fermeture à 390 et 1440 px. La suite d'installation passait. Ce résultat concernait cette version et un navigateur de test, pas tous les commits ultérieurs ni tous les vrais téléphones.
- Récupéré ensuite les réalisations de Claude : personnalisation, pages, modes, temps de focus et nouvel accueil. **Aujourd'hui `site/index.html` est l'accueil ; `site/prototype.html` redirige vers lui.** Ne pas revenir à l'ancien conseil consistant à ouvrir une landing séparée à `/prototype.html`.
- Actualisé `IDEES.md` au commit `c0bd315` : inventaire des 15 widgets et fonctions construites, statuts partiels, **35 prompts modifiables**, dont 10 lots Study. Vérifications documentaires faites ; aucune fonction Study construite et aucune suite applicative relancée pour ce changement documentaire.

### 12.3. Direction produit issue de notre conversation

- **Le moodboard reste l'écran principal.** Un grand cahier de cours peut cohabiter avec notes, minuteur, musique, ambiance et flashcards. La vision n'est pas une succession d'apps indépendantes à configurer.
- **Promesse : tous ses outils réunis.** La landing doit faire reconnaître la dispersion des notes, tâches, musique et outils de révision, puis montrer leur rassemblement. Une longue liste de widgets et une animation d'avion ne suffisent pas à expliquer la valeur de Renzvi.
- **Priorité actuelle : Study.** On ne cherche plus à multiplier des widgets qui demandent de tout retaper. Les données importées et les résultats des séances doivent alimenter les autres vues.
- Vision des grands usages : Études, Chill, Sport et Bien-être. Sport/Bien-être et les autres compositions possibles (Création, Projets, Quotidien, Voyage, Langues) sont des pistes futures, pas des modes déjà construits. Création a particulièrement plu à Damien. Il n'a pas demandé de les développer maintenant.
- La personnalisation demandée par Damien (verre plus lisible, accent, déplacement, Petit/Moyen/Grand) et les modes Study/Chill ont déjà une implémentation. Ne pas les remettre au début du backlog comme fonctions absentes.

### 12.4. Study : source unique, plusieurs outils

**Formulation retenue dans l'échange : « J'importe mon cours une fois, puis mes outils de révision se remplissent autour. »**

Le cahier conserve le document et ses chapitres. Depuis un chapitre ou un passage, on crée des cartes, textes à trous, résumés ou quiz. Une carte garde sa source pour revenir au cours. Les réponses alimentent les prochaines révisions et les difficultés, sans demander de recopier un cahier d'erreurs.

**Ordre proposé par Codex, documenté pour validation lot par lot dans `IDEES.md` :**

| Lot | Contenu | État actuel |
|---|---|---|
| S1 | Grand cahier, matières/chapitres, import texte et PDF textuel, lecture et sources privées | Non construit |
| S2 | Flashcards et textes à trous liés aux passages, création/import simples sans API | Non construit |
| S3 | Révisions du jour et répétition espacée | Non construit |
| S4 | Crédits et protection des appels IA, d'abord avec fournisseur simulé | Non construit |
| S5 | Génération depuis le cours et explication d'un passage, résultats réutilisables | Non construit |
| S6 | Quiz et retour automatique sur les erreurs | Non construit |
| S7 | Schémas masqués avec tirage aléatoire | Non construit |
| S8 | Guide Study court, contextuel, facultatif ; à enrichir au fil des lots | Non construit |
| S9 | Photos/PDF scannés et gros imports, éventuellement 200 photos de plusieurs cahiers | Reporté |
| S10 | Écouter une synthèse audio | **Explicitement reporté par Damien** |

- **Schémas :** Damien veut une « roulette ». Tirer parmi des légendes/zones pertinentes déjà identifiées, révéler puis répondre Trouvé/À revoir. Première version sans IA : l'étudiant encadre les zones une fois. La détection automatique des légendes est une extension, pas une capacité acquise.
- **Guide :** simplifier le parcours avant d'ajouter des explications. Importer, choisir un chapitre et commencer une séance ; proposer les widgets nécessaires sans écraser le moodboard existant. Le guide d'installation PWA et le premier lancement déjà présents ne remplacent pas ce guide Study.
- **Cours numériques :** un PDF peut être du texte ou un scan. Commencer par texte/PDF textuel ; ne pas promettre que tous les PDF s'extraient parfaitement. Conserver l'original et signaler les passages illisibles ou incertains.
- **200 photos :** classement par cahier, contrôle qualité, essai sur quelques pages, estimation du coût, travaux par lots reprenables et bornés. Pas une seule requête géante ; ne pas lancer ce traitement payant dans S1.

### 12.5. Choix techniques proposés par Codex, à vérifier au moment du build

Damien a confié à Codex la préparation technique des prompts pour pouvoir se concentrer sur le design. Les choix suivants sont des recommandations de départ, **pas une architecture déjà installée** :

- Conserver le site HTML/CSS/JS et Supabase ; organiser Study en modules dédiés, sans migration globale vers Next.js.
- Tables Study et stockage privé pour cours, chapitres, documents versionnés, cartes, questions et tentatives. Ne pas charger un cours entier dans `widget_state`, limité à 64 Ko par ligne ; y conserver la petite configuration du widget.
- Identifiants et références stables vers les passages/pages sources. Contrôles d'accès par compte, pas de documents publics par défaut.
- Évaluer un lecteur/extracteur PDF maintenu tel que PDF.js pour le texte et la lecture, et une bibliothèque de répétition espacée maintenue telle que `ts-fsrs`. Vérifier versions, licences et intégration avant de les installer ; ce ne sont pas des dépendances présentes.
- Un moteur de cartes/questions partagé, plutôt qu'un backend différent pour chaque widget. Réutiliser les résultats au lieu de les régénérer à chaque ouverture.
- Pour les fonctions payantes : appels serveur authentifiés, par exemple avec les fonctions Supabase ; solde et réservations atomiques côté serveur, idempotence, dépenses et retries bornés. Ne jamais mettre une clé fournisseur dans le navigateur.
- Vérifier le code et les migrations réellement appliquées. Le code à écrire, les migrations créées, les migrations appliquées et un essai sur un vrai compte sont quatre états distincts.

### 12.6. IA, crédits et prix : propositions, pas décisions commerciales finales

- Damien souhaite que les plans puissent accéder aux mêmes widgets, avec des volumes d'IA différents. Un modèle de crédits l'intéresse. **Ni cette segmentation ni les limites ne sont implémentées.**
- Repères les plus récents discutés : Pro **7,90 € TTC/mois**, Pro IA **15,90 € TTC/mois**, palier supérieur à 30 € envisagé. Les propositions précédentes à 3 €, 4,90 €, 8,80 € ou 12,90 € ne sont pas les références les plus récentes.
- La landing affiche 76 € / 153 € TTC à l'année comme hypothèses. Damien a évoqué une remise annuelle de 50 % ; **ce n'est pas une remise validée par des coûts mesurés**. Codex recommande davantage de prudence et une comparaison de rentabilité, pas de maximiser seulement l'encaissement immédiat.
- Gratuit permanent avec crédits de découverte ou essai court : **toujours ouvert**. Codex a d'abord proposé sept jours, puis a explicitement corrigé cette recommandation trop catégorique. Aucun papier psychologique ne prouve que sept jours est optimal pour Renzvi.
- Recommandation actuelle de Codex : widgets classiques gratuits et découverte IA plafonnée, puis abonnement pour un usage régulier. C'est une hypothèse à tester, pas une décision de Damien à appliquer silencieusement.
- Mesurer la marge par visiteur et la rétention, pas seulement la conversion parmi les inscrits. L'effet du gratuit ou de la personnalisation ne prouve pas une conversion payante.
- L'objectif de Damien de « plus de 90 % de bénéfice » doit être clarifié : marge après coûts directs, bénéfice net et trésorerie annuelle ne sont pas équivalents. Inclure TVA applicable, paiement, IA et infrastructure avant de promettre une marge.
- Pour limiter les abus : email vérifié, petit crédit de découverte, limites serveur de fréquence/concurrence/taille et plafond global. Une IP partagée ne prouve pas un double compte. Aucun dispositif anti-abus ni paiement n'a été construit dans cet échange.

### 12.7. Ce qu'il ne faut pas supposer à propos des modèles IA

- Aucun fournisseur ni clé n'a été configuré pour Study.
- Damien a cité fal et « Haiku 5.5 ». **Ce nom et sa disponibilité n'ont pas été confirmés.** Une clé fal donne accès à son catalogue pris en charge, pas automatiquement à tous les modèles Anthropic.
- Gemini Flash-Lite a été proposé comme candidat économique à tester pour du texte. Codex n'a pas pu vérifier les tarifs actuels : les pages externes étaient bloquées par le réseau. Le repère historique cité pour Gemini 2.5 Flash-Lite n'est pas un devis actuel ni une preuve qu'il est le moins cher du marché.
- Vérifier le modèle exact, son tarif, les postes réellement facturés, la qualité sur des cours français et les conditions d'utilisation avant de choisir. Faire les coûts sur des générations représentatives, y compris échecs et nouvelles tentatives.
- Importer/extraire une fois peut éviter de relire les photos à chaque demande, mais une nouvelle génération continue à coûter. Lire un résultat déjà stocké, retourner les cartes et planifier les révisions n'exigent pas un nouvel appel IA.
- Une grosse génération rapide n'est pas forcément chère ; un document long, une entrée image ou des appels répétés avec tout l'historique peuvent l'être. Ne pas fixer les crédits sur le seul nombre de fichiers ou de cartes.
- Recherche produit : les documentations officielles d'Anki (répétition espacée, textes à trous, images masquées, imports, séances ciblées) et d'Obsidian Canvas ont pu être consultées. Les autres apps évoquées sont des repères à revérifier ; ne pas présenter notre échange comme un audit à jour de toutes leurs offres.

### 12.8. Design et limites de présentation à transmettre

- **Landing Encre validée par Damien :** papier `#f6f5f4`, blanc `#ffffff`, encre `#242424`, texte `#615d59`, lin `#eeeae4`, sable `#d9cdbd`, scène sombre `#151515`. Ne pas réintroduire la palette bleue ou prune précédente sans sa demande.
- Conserver les animations existantes lorsqu'il demande d'améliorer l'argumentaire. La séquence de vol montre une vue depuis le siège avec hublot/aile/ciel et mouvement au défilement ; elle ne remplace pas la promesse de réunir les outils.
- Damien a autorisé des visuels générés (images, illustrations, 3D, mockups) si les outils le permettent, sans dépense supplémentaire non autorisée et sans altérer le logo.
- Pour le prototype, il veut montrer l'expérience cible au présent plutôt qu'une accumulation de « bientôt ». Le compromis préparé par Codex est une mention globale lisible de prototype et des fonctions démontrées. Ne pas en déduire que ces fonctions existent dans le dashboard ni simuler un achat ou une génération réussie.
- Les avertissements sur les images de la section 5 restent à vérifier à partir des fichiers actuels : certaines images ont déjà été remplacées. Ne pas répéter aveuglément l'ancien inventaire de fonds. La publication du prototype ne vaut pas validation de leurs droits.

### 12.9. Prochaine reprise conseillée

1. Récupérer l'état courant de `main`, vérifier les changements locaux et le lot réellement demandé par Damien.
2. Lire le statut actuel et le prompt correspondant dans `IDEES.md`. Les cases cochées signifient « trouvé dans le code », pas « revérifié en production ».
3. Si Damien lance Study sans autre précision, recommander **S1 : cahier et import unique** comme première tâche isolée. Ne pas exécuter les 35 prompts d'un coup ni anticiper les photos/audio.
4. Prendre les décisions techniques courantes, expliquer leurs conséquences, et réserver à Damien les choix produit/design, les accès manquants et les coûts nécessitant son accord.
5. Tester le lot, rendre captures et limites ; attendre son retour et une nouvelle demande de publication. Mettre ensuite à jour le statut de l'idée réellement construite.

### 12.10. Environnements et accès : ne pas confondre les comptes

- Damien a alterné entre Claude Code dans Codespaces et Claude Code cloud, notamment à cause de quotas et d'une offre promotionnelle. Leurs outils, fichiers temporaires, historiques, crédits et accès ne sont pas automatiquement identiques. Ne pas promettre qu'un crédit réservé au Web finance l'utilisation de Claude dans un terminal.
- Une limite GitHub Codespaces, une limite hebdomadaire Claude et un budget d'API du futur produit sont trois sujets distincts. Un nouveau compte GitHub doit avoir les droits d'accès au dépôt ; la facturation applicable à son Codespace doit être vérifiée, notamment si une organisation paie.
- Garder le même dépôt évite de perdre la continuité de l'historique et de Vercel. Les changements non commités d'un ancien Codespace ne sont pas récupérés simplement en ouvrant le même dépôt ailleurs.
- Un nouvel assistant doit repartir des fichiers versionnés et des accès réellement disponibles. Ne pas lui demander de refaire toute la configuration ni d'installer tous les plugins historiques si sa tâche n'en a pas besoin.

**Signature : Codex — rôle de prompteur, analyste du dépôt et soutien produit de Damien.** Cette section est identifiable comme mon complément ; elle ne réattribue pas le travail ni les vérifications historiques du premier Claude.
