# CLAUDE.md — SaaS de vidéos d'histoires animées (nom à trouver)

> À mettre **à la racine du projet**. Claude Code le lit au début de chaque session.
> Le résumé complet de mes autres projets est dans `docs/HISTORIQUE_PROJETS.md`.

---

## 1. Qui je suis et comment bosser avec moi

- Je m'appelle Damien. Je suis fondateur **non technique** : je pilote tout le dev en langage naturel avec des IA (Claude, Claude Code, Replit Agent…). Je ne sais pas coder.
- Je parle en **français familier**. Réponds-moi en français, simplement, sans jargon inutile. Quand tu dois m'expliquer un choix technique, donne-moi la conséquence concrète (coût, délai, risque), pas un cours.
- **Je veux faire mes premiers euros vite.** Priorise ce qui rapproche d'un produit vendable.
- **Ne mets jamais de secret dans le code ni dans le chat** (clés API, tokens). Utilise des variables d'environnement (`.env`, jamais commité) et dis-moi exactement quel nom de variable remplir et où.
- **Teste avant de dire que c'est fini.** Lance le code, vérifie le résultat (capture, rendu d'une vidéo test), et dis-moi honnêtement ce qui ne marche pas encore.
- **Pas de dépense cachée.** Avant d'appeler une API payante en boucle (voix, images, vidéo IA, LLM), dis-moi combien ça coûte par vidéo.
- Je déteste les designs qui font « vibecodé par IA » ou enfantins. Je veux propre, sobre, moderne.
- Je veux qu'on soit **critique** : si une idée à moi est mauvaise pour le business, dis-le franchement.
- Pas de fausses stats, faux avis, faux compteurs d'utilisateurs ni de faux prix barrés (loi française).

---

## 2. Le produit

**Pitch :** tu colles une histoire (ou juste une idée), l'outil sort une **vidéo verticale prête à poster** (TikTok / Reels / Shorts) : personnages illustrés animés, décors, voix off, sous-titres animés, bruitages.

- **Marché :** France d'abord (langue française native : voix, sous-titres, ton). D'après mes recherches, il n'y a pas encore d'équivalent sérieux en français. Ensuite, multilingue.
- **Cible :** créateurs de comptes « faceless » TikTok, petits business et marketeurs qui veulent du contenu storytelling sans se filmer. C'est du prosumer : un outil qui fait gagner de l'argent à ceux qui l'utilisent.
- **Formats visés au départ :**
  1. **Histoire illustrée** (narration grave, ambiance nuit, personnages en aplat, décors avec lumières, sous-titres mot par mot).
  2. **Motion design drôle** (fond crème, texte qui pop mot par mot en haut, objets/personnages cartoon, rythme rapide 25–30 s).
- **Stack choisie :** Supabase (j'ai déjà un compte en plan **Pro**) pour l'auth, la base et le stockage. Paiements : j'utilise **Whop** sur mes autres projets (attention à la TVA, voir §7).

### Concurrence (recherche oct. 2026, à revérifier)
StickReel (19–99 $/mois), Stickmotion (15–99 $, rig procédural), ShortFast, StoryShort, Revid, Jellypod, Korpi, Crreo, FacelessReels, et un projet open source « stickman-video-director ». Presque tout est en anglais.

### Coûts unitaires repérés (oct. 2026, à revérifier avant de fixer les prix)
| Brique | Prix indicatif |
|---|---|
| Voix ElevenLabs | ~0,17–0,20 $ / minute (plan Starter 5 $/mois ≈ 30 min, usage commercial OK ; plan gratuit = pas d'usage commercial) |
| Image Nano Banana | ~0,04 $ / image (Pro ~0,15 $ sur fal) |
| Vidéo IA Kling 2.5 Turbo | ~0,07 $ / seconde |
| Vidéo IA Veo 3.1 Fast | ~0,10 $ / seconde |
| Rendu cloud Shotstack / Creatomate | ~0,05–0,40 $ / min ; ~0,23–1 $ / min |
| Vidéo « hybride » (images + voix + montage) | ~0,60–1,50 $ / 60 s |
| **Notre moteur maison (SVG + Playwright + ffmpeg)** | **quasi gratuit** : juste du CPU (voir §4) |

➡️ **Décision de fond :** ne pas générer la vidéo avec de la vidéo IA (cher, incohérent d'une scène à l'autre). On génère un **plan de scènes** avec un LLM, puis on rend avec **notre moteur déterministe** à partir d'une **bibliothèque de scènes, personnages et décors paramétrables**. C'est moins cher, plus rapide et cohérent.

---

## 3. Architecture MVP proposée (à challenger)

```
[Front Next.js]  →  [Supabase: auth, DB, storage]
       │                    ▲
       ▼                    │  (statut + URL du MP4)
[API: crée un job]  →  [table jobs]  →  [Worker de rendu (Node + Playwright + ffmpeg)]
                                             │
                     ┌───────────────────────┼─────────────────────────┐
                     ▼                       ▼                         ▼
              LLM (script → plan        Voix (ElevenLabs API          Rendu SVG frame par frame
              de scènes JSON)           ou MP3 uploadé)               + bruitages + mix + MP4
```

- **Le worker ne peut pas être serverless** (Chromium + ffmpeg, plusieurs minutes de CPU) : il faut une VM ou un conteneur toujours dispo (Railway / Fly.io / Render / VPS). Une file de jobs dans Supabase suffit au début.
- **Le LLM ne dessine pas.** Il produit un JSON de scènes qui pointe vers des modèles existants, par exemple :
  `{"scene":"bedroom_night","duration":3.2,"characters":[{"id":"narr","pose":"phone","expr":"worried"}],"ui":"lockscreen_notif","caption":"…"}`
  Le moteur interprète ce JSON.
- **Timing piloté par la voix :** on génère (ou on reçoit) la voix, on détecte les phrases, on cale les scènes et les sous-titres dessus (voir §4.4).
- **Sorties :** MP4 1080×1920 30 fps avec piste audio, SRT, miniature.
- **Crédits :** 1 vidéo = X crédits selon la durée. Prix à fixer après avoir mesuré le coût réel (voix + CPU).

### Périmètre MVP (objectif ~2 semaines)
1. Compte + crédits + paiement.
2. Formulaire : histoire / idée → script FR généré (modifiable) → choix du style (histoire illustrée ou motion design) → choix de la voix.
3. Génération : voix → plan de scènes → rendu → MP4 téléchargeable + SRT.
4. Bibliothèque de départ : ~8 décors, ~3 personnages, ~10 écrans de téléphone, les 2 styles de texte animé.
5. Landing FR simple, avec en démo les vidéos que j'ai faites pour NoBR.

**Plan de lancement :** je construis en novembre pendant que je fais le marketing de NoBR, et **je lance en décembre**. Les créateurs qui demandent « c'est fait avec quoi ? » sous mes vidéos NoBR forment la liste d'attente.

---

## 4. Le moteur vidéo existant (fait pour NoBR) — à réutiliser

Le code est dans **`engine/`** (zip fourni : `nobr-video-engine.zip`). C'est un prototype qui marche : 11 vidéos produites, 1080×1920 30 fps.

### 4.1 Principe
- Une vidéo = une liste de **scènes** `[début, fin, fonction(t, lp), hud, grade]`. La fonction renvoie le **SVG** de l'image à l'instant `t` (`lp` = progression 0→1 dans la scène).
- `window.render(t)` assemble : scène + étalonnage (nuit/chaud) + vignettage + grain + texte d'accroche + HUD (heure, lieu) + sous-titres.
- La page `player*.html` charge les librairies, puis le script de la vidéo (`?v=v3b`), puis le fichier de timing calé sur la voix (`timing_v3b.js`).
- **Rendu :** `frames*.js` (Playwright) fait une capture JPEG q92 par image, sur **4 workers en parallèle** (plages d'images), puis `ffmpeg` (libx264, yuv420p, crf 23–24, faststart) assemble le tout avec l'audio.

### 4.2 Les librairies
| Fichier | Contenu |
|---|---|
| `lib.js` | Utilitaires (`cl`, `eo`, `eio`, `L`, `esc`), anciens bonhommes bâtons, sous-titres mot par mot (mot actif en orange). |
| `lib2.js` | `buildGroups()` : découpe les lignes de voix off en groupes de ≤ 3 mots, timing proportionnel à la longueur des mots. |
| `lib3.js` | **Style « histoire illustrée ».** Rig de personnage (`person()` : tête, cheveux fade ou bouclés, barbe, expressions, clignements, poses stand/walk/sit/phone/type/give/fist, rim light, lueur du téléphone sur le visage), décors (`bedroom2`, `dayRoom`, `street2`), téléphone tenu en main (`phoneHand`), écrans (`lock2`, `chat2`, `homeUI`, `emergencyUI`), flamme animée par niveau (`flame2`), HUD, accroche, grain, étalonnage, carte de fin, rendu avec **time-warp**. |
| `lib4.js` | Décors supplémentaires (bus de nuit, cuisine jour/nuit, snack, salle de sport, toit à l'aube, chambre gamer RGB, couloir, salle de bain, balcon, rue de jour), écrans (fil de vidéos, notif check-in, escouade, rechute/joker), cartes « RÈGLE / ERREUR », montages (flamme qui change de couleur, compteur qui s'écrase, courbe de l'envie). |
| `lib5.js` | **Style « motion design ».** Fond crème/nuit, **texte animé en haut mot par mot** (mots mesurés au pixel, mot-clé `*entre étoiles*` en orange), le **poing** héros (yeux, humeurs, tremblement, sueur, bandeau, bonnet de nuit), cerveau rose, tampons, cartes, cadenas, avatars, lit, calendrier, outro. Timeline auto à partir des phrases (`buildTimeline`). |
| `v1c/v2c/v3b/v4c.js` | Les 4 vidéos histoires NoBR. |
| `mA/mB/mC.js` | Les 3 vidéos motion design NoBR. |
| `vo/align.py` | **Calage sur la voix** (voir 4.4). |
| `vo/sfx.py` | **Bruitages synthétisés** en numpy, puis mixage. |
| `detect.py` | Détection des images mal rendues. |

### 4.3 Personnages, couleurs, polices
- Personnages (dans `CH`) : `narr` (hoodie noir à cordons orange, cheveux fade), `malik` (hoodie kaki, bouclé, barbe), `sami` (hoodie bleu marine, châtain).
- Palette NoBR : fond `#0A0A0A`, texte `#F2F0EB`, accent `#FF5A1F`, crème `#F2F0EB`. Palettes de flamme par niveau : rouge → orange → jaune → bleu → violet → blanc.
- Polices : **Barlow Condensed 800** (titres, chiffres), **Inter / Inter Display** (texte).

### 4.4 Calage sur la voix (important pour le SaaS)
1. `ffmpeg silencedetect` (−33 dB, 0,16 s) donne les segments de parole.
2. **Programmation dynamique** qui associe les phrases du script aux segments, en comparant la durée réelle à la durée attendue (nombre de caractères parlés, chiffres convertis en mots avec `num2words`), avec une pénalité pour les longues pauses à l'intérieur d'une phrase.
3. On écrit `timing_xxx.js` : les nouvelles lignes, plus une table **ancienne heure → nouvelle heure** (piecewise linéaire).
4. Au rendu, `WARPF(T)` convertit l'heure vidéo en heure « scène » : **les animations suivent la voix** et les sous-titres utilisent les heures réelles.
5. On ajoute 0,25 s de décalage au début. La vidéo finale ≈ durée de la voix + 1,3 s de carte de fin.

> Pas de Whisper possible dans mon environnement (Hugging Face bloqué). Dans le SaaS, utiliser un vrai ASR avec horodatage des mots (ElevenLabs renvoie les timestamps des caractères, ou Whisper sur le serveur) : ce sera plus précis.

### 4.5 Bruitages (`vo/sfx.py`)
Tout est synthétisé (aucun souci de droits) : whoosh (bruit filtré balayé), ding de notif à 2 notes, pop, vibration du téléphone, impact grave, tap, battement de cœur, bips de compte à rebours, swoosh d'envoi, souffle de flamme, son triste, vent, fond d'ambiance (bruit brun + 50 Hz).
- La liste des événements est définie par vidéo, en heure « scène », puis convertie avec le warp.
- Mixage ffmpeg : voix `loudnorm I=-15`, bruitages environ 10 dB en dessous, limiteur. Résultat ≈ −14,7 LUFS (le niveau TikTok).

### 4.6 Pièges déjà rencontrés (ne pas les refaire)
- **Images à moitié dessinées** : capturer juste après `render()` donne des tuiles pas finies. **Fix : attendre 2 `requestAnimationFrame` + `setTimeout(0)` avant chaque capture.** Vérifier ensuite avec `detect.py` (une image très différente de ses deux voisines alors que les voisines se ressemblent = image cassée).
- **Polices en `file://`** : Chromium bloque le chargement des polices locales (CORS). **Fix : polices en base64 dans le HTML** et `document.fonts.load()` avant de rendre.
- **CSS vs attribut SVG** : une règle CSS `text{font-family:…}` écrase l'attribut `font-family` des `<text>`. Mettre la police par défaut sur l'`<svg>` racine, jamais sur `text`.
- **Grain** : `feTurbulence` recalculé à chaque image est lent et provoque des rendus incomplets. **Fix : 4 PNG de bruit pré-générés** en `<image>` avec `mix-blend-mode:screen`.
- **Halo coupé** : un halo dans un conteneur avec fond ou `overflow:hidden` fait un rectangle visible. Pas de fond, pas de clip.
- **Perf** : ~1 850 images (62 s) ≈ 8–10 min sur 2 CPU avec 4 workers ; ~960 images (32 s) ≈ 4 min. Encodage `veryfast`. Le preset `medium` dépasse les 2 min sur 1 875 images.
- **Taille** : le grain alourdit le MP4 (crf 20 ≈ 70 Mo pour 62 s). En crf 24 ≈ 30–35 Mo.
- **TikTok** : poster la même vidéo à l'identique sur plusieurs comptes risque une détection « contenu dupliqué ». Varier l'accroche, la description et la première seconde.
- **Contenu sensible** : rester suggéré, jamais explicite (sinon portée limitée ou suppression).

---

## 5. Règles de travail pour ce projet
- Commits petits et fréquents, messages clairs en français.
- Avant de choisir une techno, donne-moi 2 options max avec coût et délai, et ta reco.
- Toute fonction qui coûte de l'argent par appel doit être **comptée** (table usage dans Supabase) et plafonnée par utilisateur.
- RGPD : pas de stockage de voix ou de visages réels sans consentement explicite. Les vidéos utilisateurs sont privées par défaut.
- Pas d'IA « en plus » sans raison : chaque appel LLM doit avoir un rôle précis (script, plan de scènes).

## 6. Prochaines étapes concrètes
1. Initialiser le repo (Next.js + Supabase) et copier `engine/` dedans.
2. Transformer le moteur en **module Node** : entrée = JSON de scènes + audio, sortie = MP4. Pas de page HTML codée en dur par vidéo.
3. Écrire le **schéma JSON des scènes** et une première bibliothèque (reprendre les décors, personnages et écrans existants).
4. Prompt LLM : script FR → JSON de scènes (avec validation stricte du JSON).
5. Worker de rendu + file de jobs Supabase + stockage du MP4.
6. Front : créer une vidéo → suivre la progression → télécharger.
7. Crédits + paiement + landing + liste d'attente.

## 7. Leçons de mes autres projets (résumé, détails dans l'historique)
- **Whop ajoute la TVA par-dessus le prix** si les prix sont réglés « hors taxe » : un prix affiché 6,99 € devient 8,39 € au checkout. En France le prix affiché doit être TTC → régler Whop en **prix TVA incluse**. Les options de collecte de TVA par Whop coûtent 2 % par vente.
- **Navigateurs intégrés TikTok/Instagram** : la connexion Google y est bloquée. Prévoir connexion par code email et un message « ouvrir dans Safari ».
- **Notifications PWA sur iPhone** : uniquement si l'app est ajoutée à l'écran d'accueil (iOS 16.4+), avec des clés VAPID.
- **Clerk** : ne pas aller en prod avec les clés de développement.
- **Replit Agent via connecteur** : les requêtes partaient en mode payant (Power) sans confirmation. Ici on bosse avec Claude Code, donc pas ce souci, mais garder l'œil sur les coûts d'API.
