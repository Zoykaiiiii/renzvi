# Mémoire du projet Renzvi

**Passation pour le prochain Claude. Remis à jour le 14 novembre 2026 (sections 1, 4, 5, 6, 16 à 18). Les sections 2 à 12 gardent leur date d'origine quand elles en ont une.**

> **Complément de passation — Codex, 7 novembre 2026.** Les sections 1 à 11 conservent la mémoire du premier Claude Code/Codespace. Lire aussi la **section 12, signée Codex**, avant de choisir la prochaine tâche : elle consigne les échanges plus récents avec Damien, la priorité Study, le rôle de chacun et les sujets encore ouverts. Les vérifications du 6 novembre ci-dessous restent datées ; elles ne sont pas des tests réexécutés aujourd'hui.

Lis ce fichier en entier avant de travailler, puis `CLAUDE.md` (règles) et `IDEES.md` (idées). Si ce fichier contredit le code ou GitHub, le code et GitHub ont raison : corrige alors ce fichier.

> ⚠️ **Ce repo est public.** N'écris jamais ici de clé, de mot de passe, d'adresse email ni de donnée d'utilisateur.

## 1. En 30 secondes

- **Le produit :** Renzvi, une seule app qui réunit tous les widgets du quotidien (study, chill, plus tard sport) sur un dashboard personnel qu'on compose comme un moodboard.
- **Le fondateur :** Damien, non technique, pilote tout en français, en langage naturel.
- **Où on en est (14 nov.) :** le dashboard est en ligne et **gratuit**. Public : 15 widgets, modes (pages), roue des modes, menu latéral repliable avec favoris, panneau Personnaliser unique, minuteur à cadran, taille fine et repli des widgets, verrou de l'appareil, menus déroulants stylés, Study S1 à S3 (Cahier, Flashcards, Révisions). Caché : Study S6 à S8 et Nutrition (`?labo=1`), 8 widgets Chill (`?chill=1`), présentations (`?vues=1`), IA S4-S5 avec un fournisseur simulé, **Mon espace Study** en arbre (`?labo=1`, section 19). Une **nouvelle landing en Next.js** existe dans `prototype/` (section 18), pas encore en ligne. Les pages légales existent avec des champs à remplir.
- **Ce qui bloque les premiers euros :** le prix n'est pas tranché (« on verra fin building »), **Whop n'est pas branché** (aucun code), les champs `[À remplir]` de `site/legal.html` sont vides, et la nouvelle landing n'est pas en ligne.
- **Ta prochaine action :** Damien attaque **la landing (la remplir) puis Whop**. Lis la section 6 et la section 18. Commence par `git fetch origin` et protège les modifications locales.

## 2. Comment travailler avec Damien

Les règles complètes sont dans `CLAUDE.md`. Voici l'essentiel, avec ce que l'expérience a ajouté :

- **Réponds en français simple.** Pour un choix technique, donne la conséquence concrète (coût, délai, risque), pas un cours.
- **Critique avant de construire.** Propose, critique franchement, contredis si l'idée est mauvaise, puis attends sa décision. Sur un ancien projet, Claude validait tout, puis de mauvais avis sont arrivés juste après : plus jamais de validation polie.
- **Vise les premiers euros.** Dis-le quand une demande ne rapproche pas de la vente.
- **Teste avant de dire « fini »** (lancer, capture) et dis honnêtement ce qui ne marche pas ou ce que tu n'as pas pu tester.
- **Pousse seulement quand Damien dit « commit push »,** directement sur `main`, avec exactement `git push origin main`. Pas de PR. Commits petits, en français.
- **Commence chaque tâche par `git fetch origin`.** Damien et Codex poussent sur `main` depuis ailleurs. Un fichier « introuvable » peut être dans un commit pas encore récupéré. S'il n'y a pas de conflit : `git pull --ff-only`.
- **Pas de dépense cachée.** Avant toute API payante : coût par utilisateur, chaque appel compté et plafonné par utilisateur.
- **Vérifications (règle du 14 nov.) :** toi, tu lances les suites de tests automatiques et tu répares celles qu'un changement casse. Pendant le travail, seulement les suites concernées ; la série complète une fois avant de dire « fini ». **Damien fait lui-même le visuel** (captures, « est-ce que ça rend bien », vrai téléphone) : pas de tours de captures ni de petits scripts pour vérifier un doute visuel. À la fin, donne-lui une courte liste (5-6 points) à regarder. Envoie des captures seulement s'il les demande.
- **Ce fichier d'abord :** mets `memoire.md` à jour après chaque tâche et pousse-le avec le travail. Damien relance souvent ses sessions (quota hebdomadaire, claude-mem qui s'arrête) : c'est la vraie passation.
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
- **Déploiement :** Vercel, réglé côté Vercel, dossier racine `site`. `site/vercel.json` pose des en-têtes de sécurité (pas d'affichage dans un cadre, `nosniff`, referrer). Pas de CI. Pour la nouvelle landing, il faudra passer le dossier racine à `prototype` (section 18).

### ⚠️ La stack réelle n'est pas celle de `CLAUDE.md`
`CLAUDE.md` prévoit Next.js. **Le site est en réalité en HTML/CSS/JS statique, sans build, avec Supabase appelé depuis le navigateur.** Aucune migration vers Next.js n'a été faite. Si le sujet revient, présente-le comme un choix avec coût et délai.

### Les fichiers

| Fichier | Rôle |
|---|---|
| `site/dashboard.html` | Tout le dashboard (environ 4 000 lignes). Catalogue `WIDGETS` et `MODES` dedans |
| `site/dash/` | Composants du dashboard sans dépendance : cadran, minuteur, roue des modes, disposition, verrou, menus déroulants (sections 15 à 17) |
| `site/legal.html` | Mentions légales, CGV, confidentialité (champs `[À remplir]`) |
| `prototype/` | Nouvelle landing Next.js + Tailwind v4 + GSAP + React Bits (section 18), pas en ligne |
| `site/login.html` | Connexion Google et code email, via Supabase |
| `site/index.html` | Accueil : « Tes outils, au même endroit » (`noindex`) |
| `site/prototype.html` | Redirige vers l'accueil, pour les liens déjà partagés |
| `site/landing.js`, `landing.css` | Scripts et styles de l'accueil |
| `site/lockin.js` | Scène du vol (hublot, WebGL) |
| `site/install.js`, `install.css`, `manifest.webmanifest`, `sw.js` | Installation de l'app. `sw.js` ne met volontairement rien en cache |
| `site/study/` | Study : `cahier.js`, `cartes.js`, `revisions.js` (publics), `ia.js`, `quiz.js`, `schemas.js`, `guide.js` (labo) |
| `site/chill/`, `site/nutrition/`, `site/vues/` | Chill (labo), Nutrition « Qu'est-ce qu'on mange ? » (labo), présentations (labo) |
| `supabase/migrations/` | Migrations SQL. Damien les colle dans l'éditeur Supabase : `list_migrations` est incomplet, vérifie tables, buckets et contraintes |
| `tests/*.check.cjs` | Suites de tests dans un vrai Chromium avec Supabase simulé (liste dans « Lancer les tests ») ; `tests/demo.cjs` (serveur de démo), `tests/menu.cjs` (aides pour le menu latéral) |
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
Le 14 nov., ces 14 suites passent : `personnalisation`, `login`, `interactions`, `parcours`, `curseurs`, `vues`, `chill`, `selects`, `cahier`, `cartes`, `repas`, `install`, `landing`, `menu-lateral`. Comptez 20 à 25 min pour toutes. Aussi : `chill.test.cjs` et `repas.test.cjs` (logique), `ia.check.sh` et `rls.check.sh` (Docker).

```bash
# Sur une nouvelle machine, une seule fois
npm i --prefix ~/pw playwright@1.56.1 && npx --prefix ~/pw playwright install chromium
sudo npx --prefix ~/pw playwright install-deps chromium

# Une suite (captures en option : SHOTS=dossier pour les suites récentes, ou un dossier en argument pour les anciennes)
NODE_PATH=~/pw/node_modules node tests/menu-lateral.check.cjs
```

Instables connus : `curseurs` (roulement des chiffres du vol) et le minuteur de `login` échouent parfois d'une seconde ; relancer avant de chercher plus loin.

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
- **Légal :** `site/legal.html` existe (mentions, CGV avec rétractation, confidentialité), liée depuis le login. **Les champs `[À remplir]` sont vides** (nom, adresse, contact, TVA, médiateur, où se gère l'abonnement) : à remplir avant le premier euro. La page promet des choses faites à la main pour l'instant (suppression sous 30 jours, purge des comptes inactifs après 3 ans). Le checkout Whop devra montrer le lien vers `legal.html#cgv`.
- **Images de la landing :** trop petites (736 px au mieux, `chat.webp` à 597 px) et **droits non vérifiés**, c'est un risque juridique une fois le site en vente. 736 px évoque Pinterest, mais ce n'est qu'une supposition. Reco faite à Damien : photos libres de droits (gratuit, environ 30 min), ou ses originaux en 1920 px, si les droits le permettent. Pas encore choisi. Les fonds du dashboard ont leurs sources dans `site/assets/credits.json`, et certaines licences exigent de citer l'auteur.
- **Modes incomplets par rapport à la décision du 3 nov. (toujours vrai le 14 nov.) :** cliquer sur un mode ne lance ni son ni playlist. Un widget ne peut être que sur une page, donc Study n'a ni musique ni ambiance. Reco déjà donnée : pas de lancement automatique du son.
- **Pas de retour arrière** après « Installer Study et Chill ». Supprimer une page déplace ses widgets sur une page voisine.
- **Temps de focus :** seul le dernier jour déjà enregistré est repris, donc le total peut sembler bas au début.
- **Une seule photo perso par compte,** même si plusieurs pages l'utilisent.
- **Widgets vides de Chill :** ils laissent des blancs, surtout Lecture. Laissé tel quel, puisque le design sera refait.
- **`.taste-skill/` n'est pas ignoré :** il n'y a pas de `.gitignore`, donc n'utilise jamais `git add -A` ou `git add .`.

## 6. Prochaines étapes

**Mise à jour du 15 nov. :** Damien branche **Whop lui-même** maintenant. Il réfléchit avec Codex au partage gratuit/Pro (aujourd'hui, le seul payant envisagé est Study). Ensuite : sa session de test de Study (fichier de test `.taste-skill/cours-test-biologie.txt`, non commité), puis brancher l'IA via Fal, puis l'import par photo des notes papier. Détails en section 19.

**Priorité de Damien au 14 nov. : remplir la landing (`prototype/`), puis brancher Whop.** Il a dit vouloir brancher Whop lui-même ; aide-le. Pour Whop : prix réglés **TVA incluse**, lien vers les CGV avant le paiement, et une limite gratuit/Pro qui n'existe pas encore dans le code (à décider avec lui). Aucune variable Whop n'est encore définie ; jamais de clé dans le code.

Ensuite, d'après ses messages : sa journée de test complète (vrai compte, vrai téléphone), puis la refonte du design.

**Ancien ordre, gardé pour l'historique :**

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
| S1 | Grand cahier, matières/chapitres, import texte et PDF textuel, lecture et sources privées | **En ligne le 9 nov.** (`10257b1`), migration appliquée. Test RLS entre deux comptes sur la vraie base pas encore fait |
| S2 | Flashcards et textes à trous liés aux passages, création/import simples sans API | **En ligne le 9 nov.** (`1469574`), migration passée par Damien. Test RLS entre deux comptes pas encore fait |
| S3 | Révisions du jour et répétition espacée | **Codé le 9 nov.** (`site/study/revisions.js`, FSRS via `site/vendor/ts-fsrs-5.4.2`, licence MIT ; migration `20261109000200_study_revisions.sql`, fonction `study_answer`). **En ligne le 9 nov.**, migration passée par Damien |
| S4 | Crédits et protection des appels IA, d'abord avec fournisseur simulé | **Codé le 9 nov.** Migration `20261109000300_ia_credits.sql` (portefeuilles, journal, travaux, grille de prix, budget global) et fonction serveur `supabase/functions/ia` avec fournisseur simulé. Tests : `tests/ia.check.sh` (Postgres et Deno dans Docker). **En ligne le 9 nov.** : SQL passé par Damien, fonction `ia` déployée (verify_jwt, version 1). Aucun fournisseur réel |
| S5 | Génération depuis le cours et explication d'un passage, résultats réutilisables | **Codé le 9 nov.** avec fournisseur simulé : `site/study/ia.js` (panneau IA du Cahier, Expliquer), `supabase/functions/ia/valider.ts` (format, citations vérifiées). Aucun modèle réel choisi ni testé |
| S6 | Quiz et retour automatique sur les erreurs | **Codé le 9 nov.**, widget `quiz` caché (`labo: true`, visible avec `?labo=1`), migration `20261109000400_study_quiz.sql` |
| S7 | Schémas masqués avec tirage aléatoire | **Codé le 9 nov.**, widget `schemas` caché, migration `20261109000500_study_schemas.sql` (bucket privé `schemas`) |
| S8 | Guide Study court, contextuel, facultatif ; à enrichir au fil des lots | **Codé le 9 nov.**, widget `guide` caché, migrations S6 à S8 passées par Damien le 9 nov. Design de tous les widgets à refaire en session dédiée |
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

## 13. Chantier Chill (labo) — Claude, 9 novembre 2026

**Caché du public.** Accès : `dashboard.html?chill=1` (gardé sur l'appareil, `?chill=0` pour sortir). Drapeau séparé de `?labo=1` (Study). Les 8 widgets Chill ont `labo: 'chill'` : absents du catalogue public, des modes, du premier lancement et de la landing. Bouton « Labo Chill » : liste des 15 fonctions, « Ajouter à la page » (vraie sauvegarde) et bac à sable (tailles Petit/Moyen/Grand, données vides/exemple/copie, chargement lent, erreurs de chargement/enregistrement/stockage ; rien n'est écrit sur le compte).

**Fichiers :** `site/chill/chill.js` (chargé partout : moteur audio unique `ChillSon` extrait du widget Ambiance, arrêt progressif, séances `chillRespiration`/`chillPause` réutilisées par les widgets publics, chargeur `chillLazy`, vue agrandie, envoi au tableau d'inspiration), puis chargés à la demande : `jardin.js`, `atelier.js` (dessin + coloriage), `jeux.js` (puzzle + tangram), `fenetre.js`, `ambiances.js` (préréglages + arrêt progressif), `cinq.js`, `labo.js`, `chill.css` (styles provisoires en variables).

**Les 15 :** 1-6 existantes (ambiance, playlist, respiration, pause, lecture, inspiration), comportement public inchangé (ambiance/respiration/pause passent par chill.js). 7 jardin, 8 dessin, 9 coloriage, 10 puzzle, 11 tangram (3 silhouettes vérifiées : carré, grand triangle, parallélogramme), 12 fenêtre, 13 mes ambiances, 14 arrêt progressif (capacité, dans « Mes ambiances »), 15 j'ai cinq minutes : développées en labo et testées automatiquement. Design à faire, intégration publique à faire pour 7-15.

**Sauvegarde :** petit état dans `widget_state` (`jardin`, `dessin`, `coloriage`, `puzzle`, `tangram`, `fenetre`, `ambiances`). Dessins en PNG dans le bucket privé `dessins` (12 max, 1,5 Mo, noms imposés). Local seulement : photo du puzzle (jamais envoyée), minuterie d'arrêt (`renzvi:sommeil`), dernière activité « cinq minutes ».

**Migration `20261109000800_chill_labo.sql` passée en ligne.** Vérifié le 10 nov. en lecture seule : le bucket `dessins` existe et `widget_state_widget_check` contient les widgets Chill. Note : Damien colle le SQL dans l'éditeur, donc `list_migrations` ne montre pas ces migrations. Il faut vérifier les tables, buckets et contraintes.

**Tests réellement lancés le 9 nov. :** `node tests/chill.test.cjs` (25 OK), `tests/chill.check.cjs` (Chromium, Supabase simulé, 2 passages OK), `tests/rls.check.sh` avec les cas Chill (RAPPORT OK, base jetable), `login` et `personnalisation` OK après le refactor. `install`, `landing`, `cahier`, `cartes` passaient au début de la session, pas relancés après.

**Limites connues :** croissance et arrosage du jardin vérifiés côté navigateur seulement (sans enjeu : pas de monnaie). Le bac à sable Ambiance partage le vrai moteur audio. Rien n'a été essayé sur un vrai téléphone ni un vrai compte. Prochaines étapes : passer la migration, essai réel, session design (illustrations, couleurs, présentation), puis intégration publique widget par widget.

## 14. Présentations de l'espace (labo) — Claude, 14 novembre 2026

**Caché du public.** Accès : `dashboard.html?vues=1` (gardé sur l'appareil, `?vues=0` pour sortir). Brief de Damien (via Codex) : plusieurs présentations des mêmes outils (grille, arbre, constellation, tableau libre, carnet, bureau à fenêtres, pièce illustrée, orbite de focus, parcours), livrées par lots. **Lot 1 fait : le socle commun et le Tableau libre.** Poussé (`945d56d`).

**Usage et présentation sont séparés.** Usage = la page (Study, Chill, pages perso) : onglets du rail. Présentation = sa disposition, choisie par page dans le sélecteur « Présentation » de l'en-tête. Exemple : Study en tableau libre, Chill en grille.

**Un seul état par outil.** Une présentation ne crée, ne copie et ne relance aucun widget. Elle ne déplace même pas les boîtes dans la page, car un iframe déplacé se recharge et la musique s'arrête. Elle change seulement leur place, avec des variables CSS (`--x`, `--y`, `--w`, `--z`) retirées en partant. Minuteur, lecteur et tâches continuent sans interruption (vérifié par test).

**Sauvegarde :** dans la ligne `ecran` de `widget_state`, sans migration. `screen.vues = { v: 1, page: { [pageId]: vueId }, places: { [vueId]: { [pageId]: { [widgetId]: { x, y, z } } } } }`. Validée au chargement par `cleanVues` : une autre version ou des valeurs abîmées font revenir la page à la grille. **Gardée même hors labo**, donc un enregistrement public n'efface rien. Limite : un futur `v: 2` serait effacé par un ancien onglet resté ouvert.

**Contrat d'une présentation** (`applyVue` dans `dashboard.html`) : un fichier `site/vues/<nom>.js` (+ `.css`) chargé à la demande, qui définit `window.vueXxx(ctx)` et rend `{ relayout(), leave() }`. `ctx` fournit `ids()`, `box(id)`, `title(id)`, `from` (place d'avant de chaque boîte, pour que rien ne saute), `places()`, `save(places)` et `say(texte)`. Pour ajouter une présentation : une entrée dans `VUES`, plus son fichier. En cas d'échec de chargement, la grille reste et un message s'affiche.

**Ouverture et fermeture réutilisables :** `zoom()` anime maintenant la boîte depuis sa place (`morph`, transformation seulement, interrompue proprement, rien en mouvement réduit). Le changement de présentation fait glisser chaque widget de son ancienne place à la nouvelle, seulement quand la personne clique, jamais au chargement. Ces deux animations s'appliquent aussi à la grille publique.

**Tableau libre :** glisser par l'en-tête ou la poignée (souris, doigt, stylet), flèches au clavier sur la poignée (16 px, Maj : 64 px), aimantation à 8 px, le widget touché passe devant. Au premier passage, chaque widget garde la place qu'il avait dans la grille. Sous 728 px, pas de placement libre : les widgets s'empilent dans l'ordre du tableau, avec une note.

**Widgets témoins testés :** Heure (simple), Tâches (éditable), Minuteur focus (minuterie), Playlist (iframe), Cahier (grand contenu). Les autres fonctionnent par construction (même boîte), mais n'ont pas été essayés un par un.

**Tests :** `tests/vues.check.cjs` (profil de démo `vues`) couvre choix par page, un seul exemplaire, minuteur et lecteur conservés, glisser souris et clavier, sauvegarde puis rechargement, retour à la grille, fermeture pendant l'animation, mouvement réduit, téléphone, panne de chargement et conservation hors labo. Le 14 nov., `vues`, `parcours`, `personnalisation`, `login`, `chill`, `cahier`, `cartes` et `install` passent. Rien n'a été essayé sur un vrai compte ni sur un vrai téléphone.

**Limites connues :** l'ouverture agrandie écrase un instant le contenu pendant le zoom (effet « app qui s'ouvre »). Le tableau ne s'élargit pas : les places sont en pixels, ramenées dans la largeur de l'écran. Les places des widgets retirés restent enregistrées, ce qui est sans effet. Prochains lots : les autres présentations, à choisir par Damien.

**Curseurs (14 nov., poussés avec `945d56d`) :** les curseurs natifs (réglages Flou/Opacité, volumes d'Ambiance) prennent le style « piste fine + bouton blanc à halo » demandé par Damien, en CSS (`input[type=range]`, remplissage par `fillRange`). Nouveau réglage **Zoom du fond** (40 à 100 %, `screen.look.fond`) dans Personnaliser > Fond, avec un curseur « en ligne » (`inlineSlider`) : sous 100 %, la photo est moins agrandie et une copie floue remplit les bords. La durée du vol est un **compteur à trois chiffres** (`minuteDial`, +/− à maintenir, flèches, Page haut/bas, Début/Fin). Les composants React/Tailwind/shadcn fournis par Damien n'ont pas été installés : le dashboard est en HTML/JS sans React, donc ils ont été refaits en JS natif, avec le même comportement. Test : `tests/curseurs.check.cjs`.

## 15. Interactions du dashboard — Claude, 14 novembre 2026

**Brief de Damien (via Codex) : barres de défilement, minuteur à cadran, roue des modes à l'appui long, création de modes, rail d'actions, taille et repli des widgets, verrou par code.** Tout est public (pas de drapeau labo). Poussé (`753bc38`). **Le rail d'actions de droite décrit ci-dessous a été retiré le 14 nov. au soir (section 17).**

**Les quatre composants fournis** (React Bits et un curseur shadcn/Radix) sont en React + Tailwind/motion ; le dashboard est en HTML/JS sans build. Ils ont été **réécrits en JS natif, sans dépendance**, dans `site/dash/` (attribution React Bits en tête de chaque fichier) :

| Fichier | Rôle |
|---|---|
| `dash/comet-dial.js` | Cadran CometDial (arc, perle, traînée selon la vitesse, élan, clavier). Le ressort de motion est remplacé par un petit intégrateur. Aucune horloge propre |
| `dash/minuteur.js` | Le widget Minuteur focus : moteur à heure de fin, préréglages + cadran + champs min/s synchronisés |
| `dash/option-wheel.js` | Roue OptionWheel (arc, flou, fondu, molette, glisser, flèches). Adaptée : options = vrais contenus, clic = choisir, Entrée = choisir |
| `dash/modes.js` | Appui long, roue des modes, fenêtre « Créer un mode », rail d'actions rapides |
| `dash/layout.js` | Taille fine (colonnes 3-12, hauteur 140-1200 px, crans de 8) et repli |
| `dash/code-slots.js` | Cases CodeSlots (champ invisible unique : clavier numérique, collage, retour arrière, flèches) |
| `dash/lock.js` | Verrou de l'appareil |
| `dash/dash.css` | Styles de tout ça, en variables du dashboard (clair/sombre, accent) |

**Pièce jointe A :** ce n'est **pas** un composant de barre de défilement, c'est le curseur `Slider` de shadcn/Radix (vertical, info-bulle). Le transformer en barre aurait détourné le défilement. Les barres sont donc stylées en CSS (`scrollbar-width`/`scrollbar-color`, et `::-webkit-scrollbar` pour Safari), avec le langage visuel du curseur (pouce rond, piste discrète). Défilement natif intact. Chrome/Edge/Safari : `::-webkit-scrollbar` (sans flèches, survol, pressé à l'accent) ; Firefox : la norme, sans état pressé. Les zones qui masquaient déjà leur barre (onglets, polices) la masquent toujours. Limites, lecteurs Spotify/YouTube et éléments du navigateur non stylables. Pas de gouttière réservée sur la page (`scrollbar-gutter`) : elle laissait une bande vide à droite du vol en plein écran. Conséquence : la page peut bouger d'une dizaine de pixels quand elle passe de « défile » à « ne défile pas » (Windows, barres classiques). Les widgets à hauteur fixe ont, eux, une gouttière stable.

**Minuteur :** données `minuteur = { length, dur (s), day, minutes, log, run }`. `run = { end }` en cours, `{ left }` en pause : une session **survit au rechargement** (ancienne limite levée). Si l'heure de fin passe pendant que la page est fermée, la session est comptée une fois au retour. Durée 0:10 à 180:00 ; minutes comptées = durée arrondie à la minute. Pendant une session, cadran, champs et préréglages sont bloqués avec « Remets à zéro pour changer la durée ». Sous 220 px de large, pas de cadran : le temps en grand et une barre.

**Modes :** un mode = une page (`screen.pages`), qui gagne `icon` et `accent` facultatifs (sans migration, ligne `ecran`). Appui long ~550 ms sur un endroit sûr (fond, cadre ou en-tête d'un widget), annulé si le doigt bouge de plus de 10 px, défilement, relâchement, sélection de texte. Jamais sur un bouton, un champ, les notes, un dessin, un lecteur, une poignée. Le relâchement ne choisit rien. Désactivé en mode Disposer (le glisser et les poignées ont la main). La roue s'ouvre **en plein écran**, centrée, fond flouté (demande de Damien du 14 nov.) ; un clic sur le fond ferme. Entrée animée : fondu du flou, titre puis modes qui glissent un à un (le mode actuel d'abord), la roue tourne jusqu'au mode actuel ; rien en mouvement réduit. Mêmes actions par le rail (« Changer de mode ») et au clavier. Max 6 modes (inchangé), donc pas de liste de débordement. **Créer un mode** : nom (unique), icône (10), couleur (8 ou celle de l'écran), départ vide ou même fond. **Pas de copie de disposition** : un widget n'existe qu'une fois et vit dans un seul mode ; copier dupliquerait ses données. « Nouvelle page » de Personnaliser garde sa création rapide (nom seul) ; même objet « page » au bout. La couleur choisie dans Réglages va au mode affiché s'il a la sienne.

**Rail d'actions** (à droite, à gauche si la barre est à droite) : Ajouter un widget (le catalogue existant), Changer de mode, Créer un mode, Disposer l'écran. Sous 1024 px : un seul bouton « Actions » en bas à droite.

**Disposition :** `screen.spans`, `screen.heights`, `screen.collapsed`, validés au chargement. Poignée en bas à droite en mode Disposer (Échap annule, flèches au clavier). Un préréglage Petit/Moyen/Grand efface la taille fine. Sous 728 px, rien de tout ça ne s'applique. « Réinitialiser la disposition » (Personnaliser > Page) remet tailles et repli sans toucher au contenu. Le déplacement existant gagne Échap pour annuler.

**Verrou :** un **écran de confidentialité sur cet appareil**, pas une sécurité du compte. Code à 6 chiffres, jamais stocké : `localStorage` garde un sel et une empreinte PBKDF2-SHA-256 (210 000 tours). Codes trop simples refusés. Se verrouille à l'ouverture, sur « Verrouiller maintenant », et en option après 5/15/30 min sans activité (ou au retour d'un onglet caché aussi longtemps). Verrouillé : tout le reste est `inert`, dialogues et roue fermés ; minuteur et sons continuent. 5 essais, puis attente de 30 s doublée à chaque erreur (15 min max). **Code oublié** = déconnexion ; la reconnexion retire le verrou de l'appareil, rien n'est effacé. **Limites assumées** : contournable par qui contrôle le navigateur (outils de développement, effacer le stockage), données non chiffrées, empreinte d'un code à 6 chiffres devinable hors ligne. Une vraie protection demanderait une vérification serveur et de bloquer l'accès aux données dans la RLS : non fait, à décider avec Damien. **Aucune migration.**

**Tests (14 nov.) :** `tests/interactions.check.cjs` (nouveau) couvre tout ce qui précède, captures avec `SHOTS=dossier`. Passent aussi : `login`, `personnalisation`, `vues`, `parcours`, `chill`, `cahier`, `cartes`, `install`, `landing`, `repas`. `curseurs` échoue une fois sur deux sur le roulement des chiffres du vol, comme avant ces changements (test instable connu). Rien essayé sur un vrai compte ni un vrai téléphone. Le rendu logiciel du Codespace est lent avec le flou plein écran de la roue : les tests attendent la fin des animations.

## 16. Menus déroulants — Claude, 14 novembre 2026

**Demande de Damien : plus de fenêtre blanche du navigateur avec surlignage bleu dans les menus déroulants.** Un seul composant, `site/dash/select.js` (+ styles `.dd-*` en fin de `dash/dash.css`), sans dépendance. Poussé (`3eee39c`).

- **Principe :** chaque `<select>` simple ajouté à la page est repéré automatiquement (observateur) et reçoit juste après lui un bouton `role=combobox` + une liste `role=listbox` (modèle WAI-ARIA « select-only combobox »). Le `<select>` natif reste la source de vérité, masqué (`.dd-native`, `aria-hidden`) : valeur, `onchange`, libellés, enregistrement et `selectOption` des tests marchent comme avant. Un `sel.value = …` du code met le bouton à jour. Sans le script, le menu natif reste.
- **Liste :** dans la couche du dessus (`popover`), donc jamais coupée par un widget ; ajoutée dans le `<dialog>` quand le menu en fait partie (sinon inerte). S'ouvre au-dessus s'il manque de place dessous, 320 px max puis défilement, suit le défilement et le redimensionnement, se ferme au clic dehors, Échap (sans fermer le dialogue), Tab, perte du focus.
- **Clavier :** flèches, Début/Fin, Page haut/bas, Entrée/Espace, saisie de lettres, Alt+flèche. Options désactivées sautées. Coche à l'accent sur l'option choisie, survol gris, focus clavier entouré à l'accent. Mouvement réduit : aucune animation.
- **Style d'un menu :** le bouton ne reprend pas la classe du `<select>` (les tests et le code qui cherchent `.cahier-pick` trouveraient deux éléments). Pour styler : `.ma-classe + .dd-trigger` ou `.parent :is(select,.dd-trigger)`. Un `<select>` qui doit rester natif : attribut `data-native`.
- **Menus concernés (10) :** page du widget (Disposer), verrou auto (menu du compte depuis le 14 nov., section 17), Cahier ×2, Flashcards, Révisions, Quiz, Schémas, Dessin, Repas ×3.
- **Tests :** `tests/selects.check.cjs` (nouveau, captures avec `SHOTS=dossier`) ; `tests/cahier.check.cjs` vérifie aussi le menu à groupes. Rien essayé sur un vrai iPhone ni sous Firefox/Safari.

## 17. Menu latéral unique et Personnaliser direct — Claude, 14 novembre 2026

**Brief de Damien (via Codex) : garder la barre de gauche, la rendre repliable, retirer la liste des modes, un seul parcours « Personnaliser », le compte sous le profil.** Poussé le 14 nov. (`5896964`).

**Le menu (`#bar`, `site/dashboard.html`)** : logo + bouton « Masquer le menu » / « Afficher le menu » (`#bar-toggle`, `aria-expanded`), « Ajouter un widget » (le catalogue existant), « Changer de mode » avec « Mode : X » dessous (ouvre la roue ; l'appui long marche toujours), Favoris, puis en bas « Personnaliser » et « Mon compte ». **La liste des modes (Mon écran, Study, Chill…) n'est plus affichée** ; les pages, leurs fonds et leurs widgets ne bougent pas.
- **Grand écran (≥ 1024 px), refait le 15 nov. à la demande de Damien (« ouverture automatique ») :** toujours une **pastille** au départ (logo + bouton, 60 × 110 px) ; l'écran garde une marge fixe (`--side` 84 px). Le menu complet (244 px, toute la hauteur) s'ouvre **par-dessus l'écran**, aucun widget ne bouge (vérifié par les tests). Plus de colonne épinglée ni de choix gardé (`renzvi:menu` est ignoré).
  - **Survol** (souris seulement, `(hover:hover) and (pointer:fine)`) : la pastille ou un **bord gauche de 12 px** (`#bar-edge`, ne recouvre aucun widget) ouvrent (`body.bar-peek`). Reste ouvert tant que la souris est sur le menu, sur le menu du compte, ou que le **focus clavier** est dedans ; se ferme 0,3 s après la sortie (pas de clignotement).
  - **Bouton « Masquer »** : ferme tout de suite ; le survol ne le rouvre pas tant que la souris n'est pas sortie de la place qu'occupait le menu. Choisir une action (Ajouter, Changer de mode, un favori, Personnaliser) ferme aussi le menu, sans ce blocage.
  - **Ouvert exprès** (clavier : Entrée sur le bouton ; ou toucher) : `body.drawer-open`, voile transparent qui avale le clic à côté (rien n'est activé dessous), Échap, focus rendu au bouton.
  - **Geste prioritaire** : bouton de souris enfoncé, glisser ou redimensionner un widget en cours = pas d'ouverture.
  - Animation 0,24 s (largeur, hauteur) ; le contenu est posé à sa largeur finale et découvert, rien ne se recompose. Aucune en mouvement réduit.
- **Tablette et téléphone** : une pastille en haut à gauche (logo + bouton) ; le menu s'ouvre en **tiroir** (voile, Échap, toucher à côté), le reste de l'écran est inerte pendant ce temps. Toujours fermé au chargement. L'ancienne rangée des modes en bas de l'écran est supprimée.
- **Supprimés** : le choix « Place de la barre » (gauche/haut/droite/bas) des Réglages, le rail d'actions de droite (`.qrail` dans `dash/modes.js`), le bouton « Réglages » séparé, « Ouvrir les réglages », le bandeau Personnaliser du bas et ses onglets téléphone.

**Favoris** : `screen.favoris` (ligne `ecran`, sans migration), liste d'identifiants de widgets, 8 au maximum, validée au chargement (inconnus et doublons oubliés). « Gérer » ouvre une fenêtre : ajouter, monter/descendre, retirer. Un favori **ne copie rien** : il change de mode si besoin, déplie le widget s'il est replié, le fait défiler, lui donne le focus et l'entoure un instant. Retirer un widget du catalogue le retire des favoris. La liste défile seule : Personnaliser et le compte restent visibles.

**Personnaliser** = le panneau de droite (`#settings`, titre « Personnaliser »), en quatre groupes : **Fond d'écran** (galerie, ta photo, zoom du fond), **Apparence** (thème clair/sombre, accent, polices, coins, espacement, verre ; pas de thème « système », il n'existait pas), **Disposition** (« Disposer les widgets » ferme le panneau et ouvre la petite barre « Disposer » du bas avec Terminer ; « Réinitialiser la disposition » demande maintenant confirmation et dit ce qui change), **Espace actuel** (mode affiché, « Créer un mode » = la même fenêtre que la roue, Renommer, Supprimer avec confirmation). La création rapide « nom seul » a disparu : un seul chemin de création. Enregistrement inchangé : automatique, curseurs enregistrés au lâcher, état honnête (« Enregistrement… », « Enregistré », « Pas encore enregistré. Nouvel essai… ») en haut du panneau.

**Compte** (`#menu`) : e-mail, abonnement, parrainage, installer l'app, **verrouillage de l'écran** (déplacé depuis les Réglages), revoir les premiers pas, déconnexion. Le raccourci « Thème, couleurs et polices » est retiré (c'est dans Personnaliser).

**Corrigé au passage** : avec 6 modes, la roue ne s'ouvrait plus du tout (erreur dans `dash/option-wheel.js`, deux classes passées d'un coup). Le panneau et le menu du compte respectent maintenant le mouvement réduit. La liste des menus déroulants (`dash/select.js`) se range dans un menu `popover` quand elle en fait partie (sinon un clic dedans fermait le menu).

**Tests** (15 nov.) : `tests/menu-lateral.check.cjs` sections 1, 1 bis et 1 ter (pastille, survol, passage au menu, bord gauche, Masquer sans réouverture, menu du compte, clavier, clic à côté, glisser jusqu'au bord). `showMenu` de `tests/menu.cjs` survole la pastille sur ordinateur. Avant : nouvelle suite `tests/menu-lateral.check.cjs` (captures avec `SHOTS=dossier`) ; aides communes dans `tests/menu.cjs` (ouvrir Personnaliser, Disposer, changer de mode par la roue au clavier, ouvrir le compte), utilisées par `personnalisation`, `login`, `interactions`, `parcours`, `curseurs`, `vues`, `chill`, `selects`. Rien essayé sur un vrai téléphone ni un vrai compte.

**Limites connues** : sur téléphone, changer de mode demande un geste de plus qu'avant (ouvrir le tiroir, puis la roue) ; l'appui long reste le raccourci. Sur grand écran, la colonne de 1100 px garde sa largeur max : replier le menu recentre l'écran plus qu'il ne l'élargit au-delà de 1 400 px.

## 18. Autres chantiers déjà poussés, jamais résumés ici (10-13 novembre 2026)

**Nouvelle landing (`prototype/`, `7f624f8`, puis `58497fb`, `d902501`).** Décision de Damien (12-13 nov.) : refaire **seulement la landing** en Next.js + Tailwind v4 + GSAP + React Bits ; le dashboard reste en HTML statique dans `site/`. Sa consigne : « Use GSAP for all motion on this site: scroll-driven sections, text reveals on scroll, a pinned hero, smooth scrolling. The bar is gsap.com/showcase. »
- `prototype/scripts/copy-site.mjs` copie `site/` dans `prototype/public/` avant le lancement et la construction (sans l'ancienne landing), donc `/dashboard`, `/login`, `/legal` gardent leurs adresses. Composants React Bits via `prototype/components.json`. Polices auto-hébergées (`next/font`).
- Aperçu : `cd prototype && npm run build && npx next start -p 3100`.
- **Mise en ligne :** dans Vercel, passer le dossier racine (Root Directory) de `site` à `prototype`. Pas encore fait.
- Ouvert : il devait envoyer une image de référence pour la barre de navigation ; le vol (ticket) est retiré de cette landing seulement, portée jamais confirmée ; les illustrations sont des emplacements vides (`Slot` dans `prototype/components/Bits.tsx`) ; la phrase aux polices changeantes montre des polices qui ne sont pas toutes dans le choix de Personnaliser ; pas de bouton « Installer l'app » ; jamais essayée sur un vrai téléphone ni dans TikTok/Instagram. Son avis du 13 nov. : « pas mal ».

**Pages légales (`1bbdb5c`)** : voir section 5. Police Hanken Grotesk hébergée sur le site (`1f030d2`) : plus d'appel à Google Fonts depuis le dashboard et le login.

**Connexion (`9e0ac6b`)** : panneau photo et formulaire sombre, Instrument Serif italique hébergée.

**Nutrition en labo (`9d5020f`, `6f56027`)** : widget `repas` « Qu'est-ce qu'on mange ? » (`?labo=1`), onglets Surprends-moi, Avec mon frigo, Chercher, Gardées. 1 020 recettes de fr.wikibooks (CC BY-SA 4.0), importées par `outils/recettes_wikibooks.py` dans `site/nutrition/recettes.json` ; chaque fiche garde le lien vers la source et la licence (obligatoire). Allergènes inconnus, c'est écrit sur chaque fiche. Migration `20261110000000_nutrition_repas.sql` passée en ligne. Un journal alimentaire ferait mentir la page de confidentialité (« pas de données de santé »). Ne pas commiter `outils/__pycache__`.

**Refonte du dashboard (`5972f54`, `2cc6b9f`, `f8757de`, `a680c0b`)** : catalogue avec aperçu et exemples, premiers pas, vue agrandie, états vides en pointillés, Réglages (thème, accents, polices, verre). La « barre flottante » de `a680c0b` a été remplacée par le menu latéral (section 17, `5896964`).

## 19. Mon espace Study (Arbre) et décisions IA — Claude, 14-15 novembre 2026

**Widget `etude` « Mon espace Study »** (`labo: true`, visible avec `?labo=1`) : prévu pour le Pro, caché tant que l'abonnement n'existe pas. Fichiers : `site/study/etude.js` (le hub plein écran : chapitres, flashcards associées, notes, lecture de l'extrait, dock avec minuteur), `site/study/arbre.js` (l'arbre dessiné depuis les vrais cours : une grosse branche par matière, un libellé par chapitre, déplacement, zoom, « Voir tout », clavier), `site/study/etude.css`. Le dock pilote le minuteur existant via `window.renzviMinuteurLive` (`site/dash/minuteur.js`) : pas de second minuteur. `dashboard.html` passe aussi `peer` et `savePeer` aux widgets.
- **Base** : migration `20261114000000_study_liens.sql`, tables `study_links` (chapitre relié à un paquet de flashcards, par référence, aucune carte copiée) et `study_notes` (une note par chapitre). **Passée en ligne par Damien le 15 nov.**, vérifiée : RLS active, 3 et 4 règles. Tests RLS ajoutés dans `tests/rls.check.sql`. Sans la migration, le widget marche en mode dégradé (testé).
- **Tests** : `NODE_PATH=~/pw/node_modules node tests/arbre.check.cjs`. Le 15 nov. : arbre, menu latéral, interactions, Cahier, Flashcards, vues, menus déroulants, personnalisation, parcours et Chill passent tous.
- **Jamais essayé par Damien** : ni Study en entier (Cahier, Flashcards, Révisions), ni l'arbre, ni sur téléphone. C'est le prochain test.

**IA : décisions et faits du 15 nov.**
- Damien a du crédit sur **Fal**. Fal donne accès aux modèles de texte (Claude, GPT, Gemini) via `openrouter/router`, et à la vision via `openrouter/router/vision`. La variante « sans entraînement sur les données » (`any-llm/enterprise`) est abandonnée chez Fal : le cours passe par Fal, OpenRouter et le fabricant du modèle, à écrire dans la page confidentialité.
- Aujourd'hui `supabase/functions/ia/fournisseur.ts` n'a que le fournisseur `simule` : une clé seule ne sert à rien. À faire : un fournisseur `fal` (environ une demi-journée), secrets Supabase `FAL_KEY` et `IA_FOURNISSEUR=fal` remplis par Damien, jamais dans le chat. Vérifier prix et modèles sur Fal avant, avec un coût par utilisateur.
- **Cours numérique (PDF avec texte, .txt, copier-coller) : pas d'IA**, le Cahier lit et découpe déjà. **Notes papier (photo, scan) : IA vision obligatoire**, l'OCR gratuit est mauvais sur l'écriture manuscrite. Reco Claude : c'est sans doute l'argument de vente n°1 de Study, à mettre en Pro avec un plafond de pages par mois et un petit crédit d'essai.
- **Ordre recommandé** : test de Study sans IA, puis Fal, puis import photo. Ne pas mélanger, sinon on ne sait pas d'où vient une panne.
- **Gratuit/Pro (hypothèse de Claude, non tranchée)** : gratuit = dashboard, widgets, import numérique, flashcards à la main, révisions ; Pro = import photo, cartes par l'IA, espace Study en arbre, plus de cours. Le payant doit se voir dans le gratuit (cadenas et aperçu), sans faux compteurs ni faux prix barrés.


## 20. Vol de focus interactif — Claude, 15 novembre 2026

**Décision de Damien (avec Codex) : le Vol de focus passera en Pro**, à retravailler. Pas encore de limite gratuit/Pro dans le code : le vol reste public pour l'instant.

**Fait le 15 nov. (`site/dashboard.html`), deuxième version après son retour (image de référence d'une appli de focus : inspiration, pas copie)** :
- Déroulé : « Déchirer et décoller » → plein écran → **on déchire le billet soi-même** (`tearTicket` : tirer le talon vers la droite ou le bas ; un petit coup ne suffit pas, le papier revient ; le bouton « Déchirer le billet » le fait d'un geste pour le clavier) → **la cabine en perspective** (`boardCabin` : nez au loin, 2 + 2 places A C | D F, numéro de rangée dans l'allée, place choisie qui s'allume, caméra qui glisse jusqu'à la rangée) avec **le même compteur à 3 chiffres** que le widget pour la durée (la destination suit) → « Décoller » : plongée vers la place, puis le hublot. « Ne pas partir » sur les deux écrans. La durée choisie dans la cabine revient dans le widget.
- **Hublot plus grand** : `--hublot-size` 88vw (téléphone), presque toute la hauteur (écran large).
- **Paysages au sol retirés** (Damien n'aimait pas) : seulement la mer de nuages, qui défile vite (vitesse ×4,5, 30 images/s). **Ambiance selon l'heure du départ** (`AMBIANCES`, `ambianceNow`) : matin (5-9 h), jour (9-17 h), coucher de soleil (17-21 h), nuit avec étoiles et lune (21-5 h). Le choix de l'ambiance par l'utilisateur n'existe pas.
- `site/lockin.js` (landing) garde son ancienne copie du vol, non modifiée.
- Tests : `tests/login.check.cjs` (déchirure à la souris, demi-déchirure qui revient, places, compteur de la cabine, durée renvoyée au widget, « Ne pas partir »).

**Reporté à la demande de Damien** : travailler avec le vol sur un deuxième écran ou quitter la page sans perdre le vol (aujourd'hui, sortir du plein écran ou de l'onglet annule le vol au bout de 10 s). À trancher avec lui : un réglage « mode deuxième écran » qui ne surveille pas le plein écran.

**Idées validées pour le Pro, pas construites** : fonds d'écran vidéo et GIF (à la Discord), avec taille plafonnée, pause en « réduire les animations », réglage de flou. La **constellation** (2e présentation de l'espace Study) vient après le test de l'arbre ; redemander son image de référence à Damien.

## 21. Vue agrandie et disposition — Claude, 15 novembre 2026

**Brief de Damien (rédigé avec Codex) : vue agrandie pleine page, puis disposition en pages horizontales à la iPhone (appui long, cases, glisser entre pages).** Découpé en lots, validé par Damien : lot 1 maintenant, en public ; lots 2 et 3 en labo ; lot 4 = passage en public après son test.

**Lot 1 (fait et poussé le 15 nov.) :**
- **Causes trouvées** : (1) la hauteur réglée à la poignée (`--h`, `site/dash/dash.css`) s'appliquait aussi à la vue agrandie, d'où un Flashcards agrandi tout plat ; (2) la vue agrandie faisait 920 px de large au plus et ne recomposait aucun contenu (horloge minuscule dans un grand cadre) ; (3) en mode Disposer, la barre d'outils (Avant, Après, tailles, Page) était **dans** le widget et l'agrandissait de 70 à 155 px, donc après « Terminer » le widget semblait rétrécir ; (4) en agrandissant, le widget quittait la grille, la page raccourcissait et le navigateur remontait.
- **Vue agrandie** (`site/dash/agrandi.css`, `zoom()` dans `dashboard.html`) : tout l'espace de l'appli (16 px de marge, bord à bord sur téléphone avec les zones sûres), pas le plein écran du navigateur. Bouton « Retour au tableau » (focus dessus à l'ouverture, retour du focus sur le bouton d'agrandissement), Échap (sauf si un menu du widget l'a déjà pris), menu et autres widgets inactifs. Un emplacement vide (`.zoom-holder`) garde la place du widget dans la grille : rien ne bouge derrière, on revient au même endroit. Le widget agrandi est un conteneur `size` : son contenu se compose avec la vraie largeur et la vraie hauteur. Compositions : Heure (grande au centre), Minuteur (grand cadran, réglages à côté), Notes (éditeur 17 px), Respiration, Temps de focus (barres hautes), états vides à taille humaine ; les listes restent une colonne centrée de 960 px au plus. Un widget replié s'ouvre en entier. Rien n'est recréé : un minuteur continue (même moteur), un texte tapé en grand est le même.
- **Grandes vues propres** : Dessin, Coloriage, Jardin (`chillAgrandir`, `site/chill/chill.css`) prennent aussi tout l'espace, bouton « Retour au tableau ». Le Cahier ouvert n'est plus écrasé par la hauteur enregistrée.
- **Disposer** : la barre d'édition flotte par-dessus le contenu, sous le titre : la taille vue en disposant est celle qui reste.
- **Barre d'édition compacte** : en mode Disposer, l'en-tête du widget ne garde que la poignée et un bouton « Options » ; Avant/Après, tailles et Page s'ouvrent dans un panneau flottant (un seul ouvert à la fois, Échap ou clic dehors le ferme). Avant, la barre cachait la case à cocher des Tâches. À la souris : poignée et bouton de 32 px ; au doigt ils gardent 44 px. Les tests ouvrent le panneau avec `options(page, titre)` de `tests/menu.cjs`.
- **Poussé le 15 nov.** (lots 1 et 2 + barre compacte). Toutes les suites passent. **Corrigé ensuite (15 nov.)** : le widget « Mes ambiances » (Chill labo) ne se chargeait plus depuis 8a610db : le vol avait ajouté une constante globale `AMBIANCES` dans `dashboard.html`, même nom que dans `site/chill/ambiances.js` (« Identifier 'AMBIANCES' has already been declared »). Celle du vol s'appelle maintenant `VOL_CIELS`. Aucun autre nom global en double entre `dashboard.html` et `site/**/*.js` (vérifié). Leçon : un test rouge « déjà rouge avant » peut cacher une vraie panne, le regarder tout de suite.
- Tests : `tests/agrandi.check.cjs` (parcours A, B, G du brief, téléphone, repli, Échap, défilement gardé).

**Lot 2 (fait et poussé le 15 nov.) : présentation « Pages »** (labo `?vues=1`, choix « Pages » dans le sélecteur Présentation de l'en-tête ; c'est une présentation comme le Tableau libre, pas un nouveau drapeau).
- Fichiers : `site/vues/pages.js`, `site/vues/pages.css`. Contrat des présentations : aucun widget recréé ni déplacé dans la page, seules des propriétés de style (grid-column/row en ligne, variables `--pg-*`), toutes retirées par `leave()`.
- Modèle : un mode (Study, Chill…) = un usage ; ses pages rangent ses widgets. Chaque page = grille de **12 colonnes × 6 rangées** qui tient dans l'écran (plus de défilement vertical ; le contenu d'un widget défile à l'intérieur). Enregistré dans `ecran.vues.places.pages[mode] = { n, d: { id: { p, c, r, w, h } } }` (page, colonne, rangée, largeur, hauteur en cases), vérifié par `cleanVues`. Conversion : un widget sans place prend la première place libre (taille = préréglage Petit/Moyen/Grand ou largeur réglée à la poignée) ; une place valide ne bouge jamais ; pages vides retirées.
- Navigation : défilement horizontal natif aimanté (doigt, pavé tactile), points en bas (« Aller à la page N », flèches au clavier, version compacte « Page 2 sur 12 » au-delà de 9 pages). La molette verticale ne tourne pas les pages. Une colonne vide de largeur nulle termine la grille pour que la dernière page s'aligne.
- Édition : **appui long 500 ms** (tolérance 8 px) sur le cadre, l'en-tête ou le vide d'un widget (jamais un bouton, champ, dessin, lecteur, curseur) ; le widget suit le doigt sans relâcher. « Disposer les widgets » (Personnaliser) ouvre la même édition. Barre en haut « Terminer » ; Échap, ou toucher le fond, termine. Pendant l'édition le contenu des widgets ne répond plus, des cases discrètes apparaissent, deux poignées par widget (déplacer, taille). Place visée montrée en pointillés ; **occupée = rouge « Place occupée », refusée, rien n'est déplacé d'office ni enregistré**. Taille à la poignée, aimantée aux cases, minimums par widget (`MIN` dans pages.js), le contenu suit en direct. Clavier : flèches (case), Maj + flèches ou poignée de taille (taille), « Place occupée » / « Bord de la page » annoncés. Enregistrement seulement quand un geste est validé.
- Appui long : sur un widget → édition ; sur le fond (y compris une case vide) → roue des modes (`site/dash/modes.js` ignore les widgets en Pages). Jamais les deux.
- Téléphone (< 728 px) : disposition **dérivée** de l'ordinateur (un widget par rangée, toute la largeur, page après page), points et balayage, **pas d'édition** (message). Disposition propre au téléphone = lot 3.
- Vue agrandie dans Pages : marche (pas d'emplacement vide ajouté, points et barre inactifs derrière).
- Tests : `tests/pages.check.cjs` (parcours C, G, I, J du brief, place refusée, clavier, rechargement, panne d'enregistrement, téléphone).
- Limites connues : au doigt, si le doigt bouge un peu pendant l'appui long, la page peut commencer à défiler et l'appui est annulé (il faut rester immobile 0,5 s) ; on ne glisse pas encore un widget vers une autre page (lot 3) ; la conversion range les widgets dans l'ordre, sans chercher la disposition la plus compacte.

**Lots suivants (à faire, en labo)** :
- Lot 3 : glisser vers une autre page par le bord (attente ~600 ms), page provisoire à droite jetée si on annule, « Déplacer vers une page », disposition séparée téléphone, rotation.
- Défilement vertical : Damien n'a pas tranché ; le lot 2 suit son brief (chaque page tient dans l'écran). À lui confirmer à son test.
