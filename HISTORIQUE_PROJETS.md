# Historique de mes projets SaaS (état au 2 novembre 2026)

> Ce fichier résume ce qu'on a fait, décidé et appris sur mes projets. Il sert de contexte pour Claude ou Claude Code.
> Aucune clé secrète ici. Les secrets sont dans les variables d'environnement de chaque projet.

---

## 1. NoBR — défi anti-porno / No Nut November (projet principal, en lancement)

### Le produit
- **NoBR** (nobr.fr), PWA B2C française en format défi : arrêter le porno et la masturbation, 30 jours ou plus, en solo ou en escouade. C'est un « Quittr français », mais **sans IA** dans l'app et **sans les astuces de paywall** du genre « −80 % ».
- Nom : « br » = branlette. Logo : le mot « **NoBR.** » avec un point orange (Barlow Condensed 800, crème `#F2F0EB` sur noir `#0A0A0A`, accent orange `#FF5A1F`).
- Le NNN a commencé le 1er novembre 2026. Les textes du site parlent de « reprendre / rejoindre le NNN en cours ».
- Interdit : fausses stats, faux avis, faux nombre de participants, faux comptes à rebours, faux prix barrés. L'app est réservée aux 18+.

### La stack
- **Replit** (Agent), monorepo React/Vite :
  - `artifacts/sans-les-mains` (front, ancien nom) ;
  - `artifacts/api-server` ;
  - `lib/db` (Postgres Replit).
  - replId : `33e6e79a-5356-409d-94de-46506cc6e8e2`.
- **Auth Clerk** (Google + email). ⚠️ Encore en clés de dev : migration en production à faire (instance prod, DNS sur Wix, OAuth Google Cloud).
- **Paiement Whop** (API v1, `checkout_configurations` avec metadata, webhook `/api/webhooks/whop`, événements `membership.activated`, `membership.updated`, `payment.succeeded`).
  - Produit `prod_Ey22dTCHFVySV`.
  - Plans :
    - mensuel 6,99 € → `plan_LpepwZeNPlP3M` ;
    - annuel 24,99 € avec 3 jours d'essai → `plan_nKrMHVs1nSUO1` ;
    - offre de sortie 17,99 €/an → `plan_b6xC0WzszXGEe`.
  - Secrets côté Replit : `WHOP_API_KEY`, `WHOP_WEBHOOK_SECRET`, `WHOP_PLAN_MENSUEL`, `WHOP_PLAN_ANNUEL`, `WHOP_PLAN_ANNUEL_OFFRE` (supprimer `WHOP_PLAN_UNIQUE`).
  - ⚠️ Whop ajoutait la TVA par-dessus (6,99 → 8,39 €). Passer les prix en **TVA incluse**.
  - L'offre de sortie se fait en plan annuel à 17,99 €, parce que Whop additionne le prix initial et le renouvellement au premier paiement.
- **Notifications web push** (service worker + VAPID). ⚠️ Il faut coller `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` et `VAPID_SUBJECT`. Sur iPhone, ça ne marche que si l'app est ajoutée à l'écran d'accueil. Si le déploiement est en Autoscale, le serveur peut dormir à 20 h : vérifier, sinon passer en Reserved VM.
- **Domaine** nobr.fr acheté chez Wix, branché sur Replit (enregistrements A + TXT, garder le TXT `replit-verify`, pas d'AAAA).

### Les fonctionnalités
- **Landing** : statique, animations « pop » simples, plus de slides empilées (elles buggaient sur iPhone). Section « événement NNN » avec le PASS NNN. FAQ.
- **Funnel interactif** : curseurs, score d'emprise, « T'en es à quel jour ? », pacte à maintenir appuyé (corrigé pour iPhone), guide d'installation de la PWA, puis paywall.
- **Espace /app** :
  - Accueil minimaliste et animé, façon Quittr. **La flamme** est au centre, avec 6 niveaux : BRAISE 0, ÉTINCELLE 3, FLAMME 7, FEU 14, BRASIER 30, INCENDIE 90. Couleurs prévues : rouge → orange → jaune → bleu → violet → blanche.
  - Chrono en direct « sans porno depuis » et semaine en ronds.
  - 5 actions rondes : Engagement, Check-in, Respirer, Blocage x/5, Rechute.
  - Bouton « J'AI UNE ENVIE » calé sous la flamme, et une icône sirène sur les autres onglets.
  - **Écran d'urgence** : caméra frontale en couleurs naturelles, « ring light » de l'écran si la pièce est sombre, décompte 3-2-1, cercle de respiration 4-4-6 autour du visage, phrases en haut, protocole de 90 s.
  - **Blocage** : guide pas à pas (iPhone : Temps d'écran + « limiter les sites adultes » + **un pote choisit le code** ; Android / PC : DNS famille). Carte masquable une fois le guide fini.
  - **Escouade** : 5 personnes max, code ou lien `nobr.fr/e/CODE`, fil d'activité, réactions (TIENS BON / RESPECT / ON EST LÀ), relance.
  - Check-in à 20 h (honnête, joker ou rechute), mission du jour, 30 leçons de discipline (nouveau texte écrit), exercices guidés, Mur, profil, lettre à soi-même, paliers, carte de flamme à partager.
- Idées non faites :
  - « gardien du code » : demander son code à son pote, toute l'escouade le voit ;
  - case 18+ ;
  - correctif de la connexion Google dans les navigateurs TikTok/Instagram ;
  - app native (App Store 99 $/an, Google Play 25 $ ; paiement Apple obligatoire dans l'app iPhone, 15 % de commission ; l'API Temps d'écran permettrait un vrai blocage). Reporté après le NNN.

### Le marketing
- 11 vidéos produites avec notre moteur maison (voir CLAUDE.md §4) :
  - 4 **histoires illustrées** avec la voix ElevenLabs de Damien et des bruitages : 01 les règles du NNN, 02 nuit 4 / bouton d'urgence, 03 mon pote a le code, 04 pourquoi tu lâches au jour 4 ;
  - 3 **motion design** drôles à mettre en voix : A ta main au chômage, B ton cerveau vs ta main, C solo vs escouade (le poing héros, inspiré d'un concurrent).
- **Concurrent direct repéré : NoFapp** (FR, App Store, vrai blocage dans l'app, code « pas avant 24 h », vidéos motion design avec une main + une montre). Notre différence : l'escouade, le bouton d'urgence avec caméra, le pote qui garde le code, la flamme.
- Bio TikTok retenue : « Le NNN, mais cette fois tu le finis. / Ton escouade te tient. 18+ ↓ ». Nom affiché « NoBR · Défi NNN ».
- Rythme : 3 posts par jour sur 3 comptes, à 6 h d'intervalle. Varier l'accroche et la description d'un compte à l'autre.
- Constat : le format bonhomme bâton fait des vues mais convertit mal. Viser environ 60 % POV / démo / slideshow, 30 % histoires, 10 % face cam. Ordre de grandeur pour 100 €/jour : environ 5 annuels par jour ≈ 750 visiteurs par jour ≈ 75–250k vues par jour.
- **Règle de décision au 30 novembre** :
  - ventes régulières → on continue (app native, positionnement « toute l'année ») ;
  - rien malgré le volume → on passe à fond sur le SaaS vidéo.

### Ce qui reste à faire (urgent)
1. Whop en TVA incluse, puis refaire un test de paiement (code promo ou essai annuel).
2. Coller les clés VAPID et les plans Whop dans les Secrets.
3. Clerk en production.
4. Mettre le webhook Whop sur `https://nobr.fr/api/webhooks/whop`.
5. Lots Replit en cours : landing statique, puis accueil + couleurs de flamme + funnel (flamme qui suit le curseur, texte machine à écrire) + leçons. **Toujours en mode Free, collés à la main** : via le connecteur, ça partait en mode Power payant.

---

## 2. Dating Photo AI (datingphotoai.fr) — en ligne, pas encore de ventes (au 8 oct.)
- SaaS B2C de portraits IA pour profils de rencontre, à partir de selfies. Replit + Supabase + fal.ai : Nano Banana Pro, puis passage à GPT Image 2.5 via fal le 7 oct.
- Assistant directeur artistique « Marianne » (Claude Sonnet 5, jugé cher : mode économie voulu).
- Paiement **Whop uniquement** (Stripe retiré), pixel Whop pour le suivi. Support Crisp + `datingphotoaifr@gmail.com`. Emails via Resend.
- Offres en crédits :
  - L'Essentiel 8,99 € (100 crédits ; 1 photo ou 1 retouche = 15 crédits) ;
  - Le Vrai Déclic 19,99 € ;
  - Le Studio 39,99 €.
- Modes de génération :
  - **Réaliste** : la photo d'origine, avec seulement la personne remplacée par le client, en 2 étapes avec un mannequin gris. Limité par pack : 3 / 8 / 20.
  - **Inspiration** : le client est ajouté dans une photo.
  - **Bibliothèque de scènes** : 11 thèmes × environ 20 photos.
  - Le client garde toujours sa coupe de cheveux, et les photos sont non retouchées (pas de « beauté IA »).
- Funnel : essai gratuit → connexion → essai simple sans quiz (décision prise après un call avec un fondateur à 40k MRR).
- Marketing : organique uniquement (zéro budget pub), persona IA ultra réaliste, format POV, plusieurs comptes. Constat du 6 oct. : peu de visites depuis les accroches.
- Règles fixes : ne jamais changer le flux de génération ni les prompts sans mon accord ; écrire soi-même les prompts exacts ; pas de contrôle IA sur mes tâches admin.

---

## 3. Idées explorées
- **SaaS vidéos d'histoires animées faceless** → c'est **le prochain projet** (voir CLAUDE.md).
- Abandonnées :
  - visites 3D immobilières (scroll web) ;
  - photos IA pour Vinted (Sapvint existe déjà) ;
  - SaaS B2C pour femmes (changer de « loc », angle ex jaloux), à faire avec un pote, en pause.

---

## 4. Ce que j'ai appris (valable pour tous les projets)
- **Prix TTC obligatoires en France.** Régler Whop en prix TVA incluse.
- **Connexion Google bloquée dans les navigateurs TikTok/Instagram** → connexion par code email + « ouvrir dans Safari ».
- **PWA iPhone** : notifications seulement si l'app est sur l'écran d'accueil ; montrer un guide d'installation dans le funnel.
- **Le funnel est l'étape la plus importante** pour convertir : interactif (curseurs), court, puis paywall clair.
- **Design** : sobre et moderne, pas enfantin, pas « vibecodé IA ». Animations simples et fiables plutôt que des effets de scroll complexes qui buggent sur mobile.
- **Contenu TikTok** : accroche dans la première seconde, texte à l'écran, produit montré vite, rester suggéré sur les sujets sensibles. Une vraie voix ou une voix ElevenLabs (plan Starter 5 $/mois, usage commercial) plutôt que la voix robot TikTok.
- **Workflow vidéo** : on m'envoie d'abord le texte de la voix off → je génère le MP3 → le moteur cale l'animation sur ma voix et ajoute les bruitages.
- **Outils IA de dev** : vérifier le mode de facturation (Replit via connecteur = Power payant). Toujours demander « combien ça coûte » avant une action en boucle.
- **Focus** : en période de lancement, le marketing passe avant tout. Un projet à côté seulement s'il ne prend pas le temps du lancement, et on le lance après.
