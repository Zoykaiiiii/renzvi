# CLAUDE.md — SaaS histoire → vidéo verticale (nom provisoire : Renzvi)

## 1. Comment bosser avec moi
- Damien, fondateur **non technique** : je pilote tout en langage naturel. Je ne code pas.
- Réponds en **français simple**. Pour un choix technique : la conséquence concrète (coût, délai, risque), pas un cours.
- **Premiers euros vite** : priorise ce qui rapproche d'un produit vendable.
- **Sois critique et franc.** Si une idée est mauvaise pour le business, dis-le. Jamais de « c'est bien » par politesse.
- **Propose et critique avant de construire**, on tranche, ensuite on code. Avant une techno : 2 options max avec coût, délai et ta reco.
- **Teste avant de dire que c'est fini** (lancer, capture, vidéo test) et dis honnêtement ce qui ne marche pas.
- **Aucun secret dans le code ou le chat.** Variables d'environnement (`.env`, jamais commité) : dis-moi quel nom remplir et où.
- **Pas de dépense cachée.** Avant toute API payante : coût par vidéo. Chaque appel payant est compté (table `usage` Supabase) et plafonné par utilisateur.
- Commits petits, messages clairs en français.

## 2. Le produit
Tu colles une histoire (ou une idée) → **vidéo verticale prête à poster** (TikTok / Reels / Shorts) : personnages illustrés animés, décors, voix off, sous-titres animés, bruitages.

- **Marché :** France d'abord (voix, sous-titres et ton natifs), multilingue ensuite. Concurrents presque tous en anglais (StickReel, Stickmotion, ShortFast, StoryShort, Revid…).
- **Cible :** créateurs « faceless », petits business, marketeurs. Prosumer : l'outil leur fait gagner de l'argent.
- **2 styles au départ :** histoire illustrée (ambiance nuit, personnages en aplat, sous-titres mot par mot) et motion design drôle (fond clair, texte qui pop, rythme rapide 25–30 s).
- **Choix de fond :** pas de vidéo IA (chère, incohérente). Un LLM produit un **plan de scènes JSON**, notre **moteur maison** (SVG + Playwright + ffmpeg) le rend à partir d'une bibliothèque de décors/personnages/écrans. Quasi gratuit, rapide, cohérent.

### Coûts unitaires (oct. 2026, à revérifier)
| Brique | Prix |
|---|---|
| Voix ElevenLabs | ~0,17–0,20 $/min (Starter 5 $/mois, usage commercial OK ; gratuit = non commercial) |
| Image Nano Banana | ~0,04 $/image |
| Notre rendu | CPU seulement |

## 3. Architecture MVP
```
Front Next.js → Supabase (auth, DB, storage) ← statut + URL MP4
     ↓
API crée un job → table jobs → Worker (Node + Playwright + ffmpeg)
                                 ├ LLM : script → plan de scènes JSON (validé strictement)
                                 ├ Voix : ElevenLabs (timestamps) ou MP3 uploadé
                                 └ Rendu SVG image par image + bruitages + mix → MP4
```
- Worker **pas serverless** : VM/conteneur (Railway, Fly.io, Render ou VPS).
- Le LLM ne dessine pas, il pointe vers des modèles existants. Sa sortie est une donnée non fiable : validée par schéma avant usage.
- Timing calé sur la voix. Sorties : MP4 1080×1920 30 fps, SRT, miniature.
- Crédits selon la durée, prix fixés après mesure du coût réel.

**Périmètre MVP (~2 semaines, lancement décembre 2026) :** compte + crédits + paiement → formulaire histoire → script FR modifiable → style + voix → génération → MP4 + SRT. Bibliothèque : ~8 décors, ~3 personnages, ~10 écrans de téléphone. Landing FR + liste d'attente.

**Prochaines étapes :** 1) repo Next.js + Supabase, moteur dans `engine/` · 2) moteur en module Node (JSON + audio → MP4) · 3) schéma JSON des scènes · 4) prompt LLM · 5) worker + file de jobs · 6) front créer/suivre/télécharger · 7) crédits, paiement, landing.

## 4. Le moteur vidéo (`engine/`, prototype qui marche)
- Vidéo = liste de scènes `[début, fin, fn(t, lp)]` qui renvoient du SVG. `window.render(t)` assemble scène + étalonnage + grain + textes + sous-titres.
- Rendu : Playwright capture chaque image (JPEG q92, 4 workers), ffmpeg assemble (libx264, yuv420p, crf 23–24, `veryfast`, faststart).
- Libs : `lib.js` utilitaires + sous-titres · `lib2.js` groupes de mots · `lib3.js` style histoire (rig personnage, décors, téléphone, écrans) · `lib4.js` décors/écrans en plus · `lib5.js` style motion design · `vo/align.py` calage voix · `vo/sfx.py` bruitages synthétisés · `detect.py` images cassées.
- **Calage voix :** silencedetect + programmation dynamique phrases↔segments, puis warp temps vidéo → temps scène. Dans le SaaS : utiliser les timestamps ElevenLabs ou Whisper.
- **Mix :** voix `loudnorm I=-15`, bruitages ~10 dB dessous, limiteur → ≈ −14,7 LUFS.

### Pièges déjà rencontrés
- Images à moitié dessinées → attendre 2 `requestAnimationFrame` + `setTimeout(0)` avant capture, vérifier avec `detect.py`.
- Polices en `file://` bloquées → base64 dans le HTML + `document.fonts.load()`.
- CSS `text{font-family}` écrase l'attribut SVG → police sur le `<svg>` racine.
- `feTurbulence` lent → 4 PNG de bruit pré-générés.
- Halo dans un conteneur avec fond/clip → rectangle visible.
- Perf : ~62 s de vidéo ≈ 8–10 min sur 2 CPU.

## 5. Design
- **Tout écran passe par le skill `design-taste-frontend`** (`.claude/skills/`).
- Je déteste le look « vibecodé par IA » ou enfantin : propre, sobre, moderne.
- Référence d'ambiance : liquidjournal.app (inspiration, **jamais copie**). Version claire voulue.
- **Décision (2 nov. 2026) : dashboard en glassmorphism clair pour démarrer** (fond blanc/gris clair, panneaux givrés, une image floue derrière). Le style pourra changer ensuite → tout passe par des variables CSS. Cette règle prime sur l'interdiction du glass dans le skill, pour le dashboard. Landing : à trancher (glass, serif italique, labels mono).

## 6. Légal et business
- Pas de fausses stats, faux avis, faux compteurs, faux prix barrés (loi française). Prix affichés **TTC**.
- RGPD : pas de voix ni visage réel sans consentement. Vidéos privées par défaut.
- Paiement Whop : régler les prix **TVA incluse** (sinon TVA ajoutée au checkout).
- Navigateurs intégrés TikTok/Instagram : pas de connexion Google → connexion par code email + message « ouvrir dans Safari ».
- Même vidéo postée à l'identique sur plusieurs comptes = risque « contenu dupliqué ».
