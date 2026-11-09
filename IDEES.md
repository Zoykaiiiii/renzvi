# Idées Renzvi

Notées le 3 nov. 2026. Rien ici n'est décidé tant qu'il n'est pas dans CLAUDE.md.

## Mise à jour du 7 novembre 2026 — comment lire ce fichier

Mise à jour par Codex à la demande de Damien. Le fichier reste modifiable : les choix techniques ci-dessous sont des recommandations de réalisation, le design et les usages restent à valider par Damien. Ne lancer aucun des prompts automatiquement en lisant ce fichier.

- `[x]` : fonctionnalité trouvée dans le code de `main` au commit `3cb4997`. Cela ne signifie pas qu'elle vient d'être retestée sur un vrai compte ou sur Vercel.
- `[ ]` : à construire, à décider ou reporté. **Partiel** précise ce qui manque ; une démonstration de landing ne compte pas comme un widget construit.
- Les anciennes propositions sont conservées, y compris les doublons et leur attribution. Les prix, délais et restrictions commerciales historiques ne sont pas des décisions actuelles.
- Les prompts sous les idées partielles ne concernent que leur partie manquante. Ne pas reconstruire les widgets cochés. Les doublons renvoient au même chantier lorsqu'il existe déjà un prompt équivalent.
- **Dernière direction de Damien : priorité à Study**, un cours importé une fois puis réutilisé pour plusieurs outils. Le périmètre et les prompts sont dans [Study : idées et prompts](#study--idées-et-prompts-de-réalisation-7-novembre-2026). Cette direction est postérieure aux recommandations de priorité consignées le 6 novembre dans `memoire.md`.

### Déjà construit — inventaire vérifié dans le code

Source principale : catalogue `WIDGETS`, `MODES`, configuration `screen` et fonctions d'affichage/sauvegarde dans `site/dashboard.html`.

- [x] Vol de focus : ticket, déchirure, hublot, durée et destination associée, statistiques du jour. Sortir déclenche une période de grâce de 10 secondes avant annulation ; aucun blocage du téléphone.
- [x] Tâches.
- [x] Heure et date.
- [x] Minuteur focus.
- [x] Temps de focus : total de la semaine, vols et minuteur réunis ; pas de répartition par matière.
- [x] Notes.
- [x] Habitudes : suivi des jours ; ne pas confondre avec un compteur de séries déjà construit.
- [x] Respiration guidée.
- [x] Ambiance sonore : pluie, vent, feu de bois, cabine, bruit blanc ; sons synthétisés dans le navigateur.
- [x] Compte à rebours.
- [x] Mes raccourcis.
- [x] Playlist Spotify / YouTube, chargée après une action de l'utilisateur.
- [x] Pause détente.
- [x] Suivi de lecture.
- [x] Tableau d'inspiration avec images personnelles.
- [x] Connexion Google / code email et sauvegarde Supabase ; prise en compte des navigateurs intégrés.
- [x] Fonds d'écran et photo personnelle.
- [x] Personnalisation : verre givré, choix d'accent, déplacement des widgets et tailles Petit / Moyen / Grand.
- [x] Pages personnelles : création, renommage, suppression et rangement des widgets.
- [x] Modes Study et Chill : compositions installables et changement de page ; pas de lancement automatique de son ni de bibliothèque partagée de widgets entre pages.
- [x] Premier lancement : fond puis proposition d'installation de Study et Chill. Le guide Study par cours reste à construire.
- [x] Parrainage : lien, attribution et compteur.
- [x] PWA : manifeste, icônes et guide illustré d'installation. Aucun mode hors connexion promis.
- [x] Landing Encre, argumentaire des outils réunis, scène avion et démonstrations. `site/index.html` est l'accueil ; `site/prototype.html` redirige vers lui.

Restent notamment absents : cahier de cours, flashcards, quiz, répétition espacée, génération IA, portefeuille de crédits IA et paiement. Les suites `tests/login.check.cjs`, `tests/personnalisation.check.cjs`, `tests/install.check.cjs` et `tests/landing.check.cjs` existent ; elles n'ont pas été relancées pour cette mise à jour documentaire.

## Le concept (précisé par Damien le 3 nov. 2026)
- **Renzvi = une seule app qui réunit tous les widgets** : study, sport, chill, ambiance, etc.
- On compose son dashboard avec les widgets qu'on veut, **comme un moodboard**.
- C'est ça qu'on vend. Aucune feature n'est la star : le ticket ci-dessous est un widget parmi d'autres.

## Widget : le ticket de vol de focus
- [x] Un widget en forme de ticket d'avion. On le **déchire** (animation), ça lance un « vol » : la durée du focus = la durée du vol.
- Idée de départ : verrouiller le téléphone pendant le vol. **Impossible en PWA** (un site ne peut pas bloquer le téléphone). En app native c'est très limité : sur iPhone il faut une autorisation spéciale d'Apple (Temps d'écran), sur Android des permissions sensibles.
- [x] Version PWA retenue : le vol est **annulé** si on quitte l'onglet ou l'appli avant l'arrivée. L'engagement vient de la règle, pas du blocage. La page ne doit jamais dire que ça verrouille le téléphone. Le code actuel accorde 10 secondes pour revenir.
- Damien sait que ce genre de concept existe déjà sur TikTok : c'est la preuve que ça plaît. Le projet est une **grosse production** : le ticket doit être soigné, pas une copie.
- [ ] Plus tard, si ça prend : une vraie app native avec blocage. Ancienne estimation « App Store 99 $/an, validation de plusieurs semaines » à revérifier avant toute décision.

<details>
<summary>Prompt futur — Application native avec blocage</summary>

```text
Objectif
Évaluer une application native seulement si Damien relance cette idée.

Contexte
La PWA existe et ne peut pas bloquer les autres applications. Le projet reste aujourd’hui un site statique. Appliquer le contrat commun Study d'IDEES.md : sécurité, conservation des données et tests. Cette idée est hors priorité Study V1 et attend une demande explicite.

Décisions et réalisation
Faire un diagnostic iOS/Android à partir des documentations officielles actuelles : permissions, autorisations spéciales, distribution et coûts. Recommander au maximum deux options, puis un petit prototype autorisé sur un vrai appareil. Réutiliser les comptes et contenus sans les exposer.

À ne pas faire
Ne pas promettre de verrouillage avant preuve, ni migrer le produit ou engager de frais de publication dans ce diagnostic.

Vérifications et résultat attendu
Vérifier les limites sur appareils réels ; rendre une recommandation, les coûts et les autorisations encore nécessaires. Expliquer les changements en français simple et distinguer ce qui a été réellement exécuté.

Pas de commit ni de push sans un nouveau « commit push » de Damien.
```

</details>

## Autour du ticket
- [ ] **Partiel —** destination choisie, billet généré (Paris → Tokyo, 2 h 30). Le billet est construit, mais la destination dépend de la durée ; le choix libre de destination n'existe pas.

<details>
<summary>Prompt futur — Choix de destination</summary>

```text
Objectif
Permettre de choisir une destination symbolique du vol.

Contexte
ROUTES et le billet existent dans site/dashboard.html ; la destination dépend actuellement de la durée. Appliquer le contrat commun Study d'IDEES.md : sécurité, conservation des données et tests. Cette idée est hors priorité Study V1 et attend une demande explicite.

Décisions et réalisation
Proposer une sélection de trajets et une règle cohérente entre durée et destination, avec valeurs par défaut pour les anciennes données. Garder le même ticket, la seule ambiance hublot et les statistiques existantes.

À ne pas faire
Pas de carte 3D, de GPS ou d’API de vrais horaires. Présenter les trajets comme des repères de concentration.

Vérifications et résultat attendu
Tester choix, changement de durée, rechargement, annulation et fin de vol ; rendre captures et tests. Expliquer les changements en français simple et distinguer ce qui a été réellement exécuté.

Pas de commit ni de push sans un nouveau « commit push » de Damien.
```

</details>
- [ ] **Partiel —** carnet de voyages : tampons de passeport, statistiques de vols réussis. Compteurs du jour et temps hebdomadaire construits ; pas de carnet ni de tampons.

<details>
<summary>Prompt futur — Carnet de voyages</summary>

```text
Objectif
Conserver un historique des vols réussis et un carnet visuel.

Contexte
Des compteurs du jour et un total hebdomadaire existent, pas un historique détaillé. Appliquer le contrat commun Study d'IDEES.md : sécurité, conservation des données et tests. Cette idée est hors priorité Study V1 et attend une demande explicite.

Décisions et réalisation
Enregistrer les prochains vols terminés avec un identifiant stable, date, durée et destination. Afficher un carnet avec tampons et détails ; distinguer séances réussies et annulées. Prévoir stockage privé et reprise idempotente.

À ne pas faire
Ne pas inventer d’anciens vols à partir des totaux ; pas de récompenses présentées comme de vrais voyages.

Vérifications et résultat attendu
Tester double événement de fin, changement de jour, rechargement et accès entre comptes ; rendre captures et tests. Expliquer les changements en français simple et distinguer ce qui a été réellement exécuté.

Pas de commit ni de push sans un nouveau « commit push » de Damien.
```

</details>
- [ ] **Partiel —** sons d'ambiance (cabine d'avion, pluie, café), sons libres de droits. Le mélangeur existe avec des sons synthétiques ; le café n'est pas dans le catalogue actuel.

<details>
<summary>Prompt futur — Sons café et forêt</summary>

```text
Objectif
Compléter le mélangeur existant avec les ambiances encore absentes.

Contexte
Le widget actuel synthétise pluie, vent, feu, cabine et bruit blanc. Appliquer le contrat commun Study d'IDEES.md : sécurité, conservation des données et tests. Cette idée est hors priorité Study V1 et attend une demande explicite.

Décisions et réalisation
Proposer café et forêt, avec volumes indépendants et intégration au volume général. Choisir une synthèse adaptée ou des fichiers locaux dont les droits commerciaux et les crédits sont vérifiés. Garder les commandes existantes et la lecture volontaire.

À ne pas faire
Pas d’abonnement audio externe, de lecture automatique ou de fichiers sans source vérifiable.

Vérifications et résultat attendu
Tester mobile, pause/reprise, changement de page, suppression du widget et arrêt des ressources ; rendre poids des assets, sources et tests. Expliquer les changements en français simple et distinguer ce qui a été réellement exécuté.

Pas de commit ni de push sans un nouveau « commit push » de Damien.
```

</details>

## Public visé (à confirmer)
- Reco : étudiants et jeunes qui bossent. Prix bas (2 à 4 €/mois). Alternative : freelances.

## Features V1 proposées (sans API IA payante ; hébergement et stockage restent à financer)
- [x] Dashboard avec photos de fond floutées.
- [x] Minuteur focus et temps de focus de la semaine.
- [ ] **Partiel —** tâches du jour, habitudes avec séries, notes. Les trois widgets existent ; un véritable compteur de séries reste à construire.

<details>
<summary>Prompt futur — Séries des habitudes</summary>

```text
Objectif
Compléter le suivi des habitudes avec des séries compréhensibles.

Contexte
Les jours cochés sont enregistrés ; vérifier leur durée de conservation avant de calculer une longue série. Appliquer le contrat commun Study d'IDEES.md : sécurité, conservation des données et tests. Cette idée est hors priorité Study V1 et attend une demande explicite.

Décisions et réalisation
Définir série actuelle et meilleure série, avec règles explicites pour aujourd’hui non encore coché et corrections rétroactives. Prévoir des données durables si les jours anciens sont purgés, sans inventer de passé.

À ne pas faire
Pas de série créée artificiellement pour les anciennes habitudes ni d’appel IA.

Vérifications et résultat attendu
Tester minuit, fuseau, jours manquants, corrections et rechargement ; rendre règles, captures et tests. Expliquer les changements en français simple et distinguer ce qui a été réellement exécuté.

Pas de commit ni de push sans un nouveau « commit push » de Damien.
```

</details>
- [x] Compte et sauvegarde téléphone/ordi (Supabase). Les écritures simultanées restent à surveiller : pas de synchronisation collaborative promise.

## Plus tard (afficher « bientôt », ne pas promettre)
- [ ] Fiches de révision (type Anki), initialement V2. **Repriorisées dans Study par Damien le 7 novembre**, voir les prompts ci-dessous.
- [ ] Synchro Google Agenda. L'ancienne estimation « vérification Google = des semaines » reste à vérifier.

<details>
<summary>Prompt futur — Google Agenda</summary>

```text
Objectif
Étudier une connexion de calendrier sans engager une intégration OAuth lourde avant validation.

Contexte
L’idée existe mais aucun widget agenda connecté n’est construit. Appliquer le contrat commun Study d'IDEES.md : sécurité, conservation des données et tests. Cette idée est hors priorité Study V1 et attend une demande explicite.

Décisions et réalisation
Vérifier les règles Google actuelles et comparer import ICS en lecture seule et connexion OAuth. Recommander une option avec coût et délai, puis construire uniquement le périmètre autorisé. Pour l’ICS, prévoir aperçu, fuseaux et prévention des doublons.

À ne pas faire
Ne pas promettre une synchronisation live avec un fichier importé ; pas de secret client dans le navigateur ni de modification des événements source.

Vérifications et résultat attendu
Tester réimport, récurrences, fuseaux et accès privé ; rendre les limites et la configuration réellement nécessaire. Expliquer les changements en français simple et distinguer ce qui a été réellement exécuté.

Pas de commit ni de push sans un nouveau « commit push » de Damien.
```

</details>
- [ ] Calories, sport, poids : reportés ; chaque sujet peut devenir une app entière.

## Gratuit / payant (à trancher)
- Gratuit : dashboard, minuteur, tâches, habitudes, 3 fonds.
- Pro : photos perso en fond, tous les sons, statistiques détaillées. Prix TTC.

## À faire ensuite
- [x] Damien envoie ses designs Refero (référence d'ambiance, jamais une copie). Référence Notion analysée et direction Encre appliquée à la landing.
- [x] Landing construite autour du dashboard moodboard (tout en une app), le ticket dans la vitrine des widgets. Accueil et démonstrations présents dans `site/index.html` ; les features futures montrées ne sont pas toutes construites.

## Décisions du 3 nov. 2026
- [x] **V1 = deux modes : Study et Chill.** Pages et compositions proposées dès le premier lancement.
- [ ] Sport arrive après (ancienne piste V1.5 : minuteur d'intervalles + 3-4 programmes en texte ; illustrations/3D bien plus tard).

<details>
<summary>Prompt futur — Mode Sport</summary>

```text
Objectif
Créer plus tard une composition Sport avec un minuteur d’intervalles et quelques séances textuelles.

Contexte
Study et Chill existent dans MODES ; Sport reste absent. Appliquer le contrat commun Study d'IDEES.md : sécurité, conservation des données et tests. Cette idée est hors priorité Study V1 et attend une demande explicite.

Décisions et réalisation
Réutiliser pages, fonds et catalogue existants. Prévoir préparation, effort, repos, répétitions, pause et reprise par heure de fin fiable. Ajouter quelques exemples d’exercices dont les sources et droits sont vérifiés, avec intensité adaptable.

À ne pas faire
Pas d’IA, de calories estimées automatiquement, de programme médical ou de 3D dans cette première version.

Vérifications et résultat attendu
Tester arrière-plan, retour, changement de page et annulation ; rendre captures, tests et sources des séances. Expliquer les changements en français simple et distinguer ce qui a été réellement exécuté.

Pas de commit ni de push sans un nouveau « commit push » de Damien.
```

</details>
- [ ] **Partiel —** un mode = un préréglage : fond + widgets + ambiance sonore + playlist, activé en un clic. Pack Study prêt à l'emploi à l'inscription. Les compositions existent ; le son et la playlist ne se lancent pas automatiquement et ne sont pas configurés en un pack complet.

<details>
<summary>Prompt futur — Composition et musique par mode</summary>

```text
Objectif
Compléter la personnalisation des compositions sans perdre l’espace de l’utilisateur.

Contexte
Les modes sont des pages déjà remplies ; le son et la playlist ne se lancent pas au changement. Appliquer le contrat commun Study d'IDEES.md : sécurité, conservation des données et tests. Cette idée est hors priorité Study V1 et attend une demande explicite.

Décisions et réalisation
Permettre d’associer une ambiance enregistrée et une référence de playlist à une composition, avec une action explicite pour les lancer. Définir l’arrêt ou la poursuite du son lors du changement et préserver les modifications des pages. Vérifier la limite actuelle d’un widget par page avant toute promesse de partage.

À ne pas faire
Pas de démarrage audio automatique et pas de duplication du widget en perdant ses données.

Vérifications et résultat attendu
Tester changement de mode, consentement lecteur, rechargement et pages personnalisées ; rendre comportement choisi et tests. Expliquer les changements en français simple et distinguer ce qui a été réellement exécuté.

Pas de commit ni de push sans un nouveau « commit push » de Damien.
```

</details>
- [ ] **Partiel —** musique : lecteur Spotify intégré (iframe) avec une playlist par mode, + alternative YouTube. Les lecteurs existent ; une bibliothèque par mode et la connexion Spotify complète restent à étudier.

<details>
<summary>Prompt futur — Connexion Spotify complète</summary>

```text
Objectif
Évaluer une connexion Spotify seulement si les liens et lecteurs intégrés ne suffisent plus.

Contexte
Les widgets Spotify/YouTube intégrés existent déjà ; les règles et accès API peuvent changer. Appliquer le contrat commun Study d'IDEES.md : sécurité, conservation des données et tests. Cette idée est hors priorité Study V1 et attend une demande explicite.

Décisions et réalisation
Identifier le besoin supplémentaire, vérifier la documentation actuelle, permissions et conditions des comptes. Recommander au maximum deux options avec leurs coûts. Implémenter seulement après les accès nécessaires, avec autorisations minimales et déconnexion claire.

À ne pas faire
Ne pas remplacer les lecteurs fonctionnels pour une connexion cosmétique, ni promettre des contrôles interdits par le fournisseur.

Vérifications et résultat attendu
Tester refus, expiration d’accès et déconnexion ; rendre les limites réelles et les permissions demandées. Expliquer les changements en français simple et distinguer ce qui a été réellement exécuté.

Pas de commit ni de push sans un nouveau « commit push » de Damien.
```

</details>
- Tarif envisagé : gratuit permanent limité + Pro avec essai de 14 jours sans carte (à confirmer).

## Idées en plus (non tranchées)
- [ ] Study : vol de groupe (invite un ami).

<details>
<summary>Prompt futur — Vol de groupe</summary>

```text
Objectif
Partager une séance de concentration avec une invitation privée.

Contexte
Le vol actuel est individuel ; aucune présence de groupe n’existe. Appliquer le contrat commun Study d'IDEES.md : sécurité, conservation des données et tests. Cette idée est hors priorité Study V1 et attend une demande explicite.

Décisions et réalisation
Définir hôte, invitation, début commun et comportement d’un participant qui quitte. Réutiliser le vol existant avec horloge serveur de référence et accès limité aux membres. Commencer avec un petit groupe et gérer les reconnexions.

À ne pas faire
Pas de classement public, de chat, de faux participants ou de verrouillage du téléphone.

Vérifications et résultat attendu
Tester deux comptes, invitation invalide, départ d’un membre et reconnexion ; rendre démo et tests. Expliquer les changements en français simple et distinguer ce qui a été réellement exécuté.

Pas de commit ni de push sans un nouveau « commit push » de Damien.
```

</details>
- [ ] Study : escale = pause du vol.

<details>
<summary>Prompt futur — Pause du vol</summary>

```text
Objectif
Étudier une pause explicite de séance sans casser les règles du vol.

Contexte
Le minuteur a une pause ; le vol fonctionne par heure de fin et annulation après sortie. Appliquer le contrat commun Study d'IDEES.md : sécurité, conservation des données et tests. Cette idée est hors priorité Study V1 et attend une demande explicite.

Décisions et réalisation
Définir clairement les états vol/pause/reprise, la durée restante et le temps effectivement compté. Montrer la règle avant démarrage. Garder une seule ambiance et préciser si quitter l’onglet pendant la pause reste une annulation ; conserver par défaut la règle actuelle tant que Damien ne la change pas.

À ne pas faire
Pas de pause implicite qui permet de comptabiliser du temps non travaillé ni de changement silencieux de la règle de sortie.

Vérifications et résultat attendu
Tester pause près de la fin, reprise, annulation et rechargement ; rendre règles et tests. Expliquer les changements en français simple et distinguer ce qui a été réellement exécuté.

Pas de commit ni de push sans un nouveau « commit push » de Damien.
```

</details>
- [ ] Study : vol longue distance pour les examens. Le choix de durée jusqu'à 180 minutes existe ; l'extension produit reste à préciser.

<details>
<summary>Prompt futur — Longue séance de révision</summary>

```text
Objectif
Préciser la valeur d’une longue séance avant d’ajouter un doublon du vol actuel.

Contexte
Le curseur propose déjà jusqu’à 180 minutes ; ce besoin peut être satisfait sans nouveau widget. Appliquer le contrat commun Study d'IDEES.md : sécurité, conservation des données et tests. Cette idée est hors priorité Study V1 et attend une demande explicite.

Décisions et réalisation
Vérifier ce qui manque réellement : présélection d’une durée, destination symbolique ou organisation en sessions. Recommander la plus petite évolution, puis la construire si elle respecte la règle du vol et les limites de durée validées.

À ne pas faire
Ne pas créer un deuxième moteur de minuterie, de carte de vol ou une durée étendue sans comportement de fin fiable.

Vérifications et résultat attendu
Tester longue durée par horloge simulée, comptage et annulation ; rendre le périmètre choisi et les tests. Expliquer les changements en français simple et distinguer ce qui a été réellement exécuté.

Pas de commit ni de push sans un nouveau « commit push » de Damien.
```

</details>
- [x] Study : compte à rebours d'examen.
- [ ] Study : suivi par matière. Le widget Temps de focus ne répartit pas encore ses minutes par matière.

<details>
<summary>Prompt futur — Focus par matière</summary>

```text
Objectif
Voir la répartition du temps de travail par matière.

Contexte
Le widget Temps de focus additionne les vols et minuteurs de la semaine ; S1 doit fournir les matières. Appliquer le contrat commun Study d'IDEES.md : sécurité, conservation des données et tests. Cette idée est hors priorité Study V1 et attend une demande explicite.

Décisions et réalisation
Associer facultativement une matière à la séance, conserver des événements de focus identifiables et afficher les totaux par matière. Garder une catégorie non attribuée pour les anciennes données et suivre les corrections sans double-comptage.

À ne pas faire
Ne pas inventer la matière des anciennes séances ni annoncer une maîtrise du cours à partir du temps passé.

Vérifications et résultat attendu
Tester séances terminées/annulées, suppression d’une matière, minuit et totaux ; rendre captures et tests. Expliquer les changements en français simple et distinguer ce qui a été réellement exécuté.

Pas de commit ni de push sans un nouveau « commit push » de Damien.
```

</details>
- [ ] Study : carte de partage TikTok.

<details>
<summary>Prompt futur — Carte de partage</summary>

```text
Objectif
Exporter volontairement un bilan de séance sous forme d’image.

Contexte
Les statistiques de focus existent ; l’export social reste absent. Appliquer le contrat commun Study d'IDEES.md : sécurité, conservation des données et tests. Cette idée est hors priorité Study V1 et attend une demande explicite.

Décisions et réalisation
Créer un aperçu et un téléchargement d’image avec durée et date choisies. Permettre de retirer prénom et détails privés. Utiliser le logo exact et des chiffres provenant des données du compte.

À ne pas faire
Pas de publication automatique ou de connexion à TikTok, pas de faux record ni de cours privé sur la carte par défaut.

Vérifications et résultat attendu
Tester valeurs réelles, anonymisation, format mobile et export ; rendre exemples et tests. Expliquer les changements en français simple et distinguer ce qui a été réellement exécuté.

Pas de commit ni de push sans un nouveau « commit push » de Damien.
```

</details>
- [ ] Study : mode « study with me » plein écran distinct du vol.

<details>
<summary>Prompt futur — Vue de concentration</summary>

```text
Objectif
Afficher plus tard une vue agrandie de travail avec les outils choisis.

Contexte
Le plein écran du vol existe ; ce besoin est distinct et doit rester lié au moodboard. Appliquer le contrat commun Study d'IDEES.md : sécurité, conservation des données et tests. Cette idée est hors priorité Study V1 et attend une demande explicite.

Décisions et réalisation
Proposer une vue de concentration sur le cours, les notes ou le minuteur actifs, avec commandes visibles pour revenir. Réutiliser les états et données existants et gérer le refus de plein écran du navigateur.

À ne pas faire
Pas de nouvelle ambiance du vol, pas de blocage du téléphone ni de perte de notes au changement de vue.

Vérifications et résultat attendu
Tester Escape, mobile sans API plein écran, musique et notes en cours ; rendre captures et tests. Expliquer les changements en français simple et distinguer ce qui a été réellement exécuté.

Pas de commit ni de push sans un nouveau « commit push » de Damien.
```

</details>
- [ ] Fiches de révision : création manuelle/import et génération par IA ensuite, coût compté et plafonné. L'ancienne restriction « réservée au Pro » est historique : Damien envisage désormais tous les widgets accessibles, avec des volumes IA différents selon le plan ; rien n'est encore facturé.
- [ ] Sport (plus tard) : séance = vol sport, repos = escale ; base d'exercices libre à vérifier (wger, free-exercise-db) ; avertissement santé obligatoire.

## Propositions Codex — widgets et mode Chill (4 nov. 2026)

Idées ajoutées par Codex à la demande de Damien, à partir de leur échange. Les cases ont été actualisées le 7 novembre d'après le code. Les doublons avec les idées déjà notées sont conservés volontairement.

### Widgets proposés par Codex
- [x] **Compte à rebours personnel** : examen, vacances ou événement, avec un titre et une date. Déjà évoqué plus haut ; proposition également faite par Codex. Un widget est actuellement rangé sur une seule page à la fois.
- [x] **Ambiance sonore** : mélangeur construit. Proposition Codex d'origine : pluie, forêt, café, feu de bois ou cabine ; le catalogue construit contient pluie, vent, feu de bois, cabine et bruit blanc. Forêt/café restent des extensions non réalisées. Les sons actuels sont synthétiques.
- [x] **Mes raccourcis** : épingler ses liens vers les cours, documents, outils et sites favoris pour les retrouver sur le dashboard.
- [x] **Tableau d'inspiration** : épingler quelques images avec de petites légendes pour rendre le dashboard plus personnel et renforcer le concept de moodboard.
- [x] **Suivi de lecture** : choisir un livre, noter sa progression et conserver une citation ; un lien entre études et détente.
- [x] **Playlist** : retrouver sa playlist Spotify ou YouTube dans un widget. Lecteurs intégrés présents, sans connexion complète au compte Spotify. Déjà évoqué plus haut ; proposition également faite par Codex.

### Chill, détente et bien-être — propositions Codex
- [x] **Respiration guidée** : un cercle pour accompagner une respiration douce. Proposition initiale de durées 1, 3 ou 5 minutes ; vérifier les choix actuels dans le widget avant toute extension. Un outil de détente, sans promesse médicale.
- [x] **Pause détente** : choisir une courte pause (regarder au loin, s'étirer, marcher), accompagnée d'un petit compte à rebours.
- **Piste de priorité proposée par Codex** : respiration guidée et ambiance sonore pour donner une utilité immédiate au mode Chill. Le compte à rebours et le tableau d'inspiration restent des pistes pour le prototype. Ordre de développement à confirmer avec Damien.

### Chantier Chill en labo (9 nov. 2026) — caché, `?chill=1`
Détail dans `memoire.md` section 13. Aucune de ces fonctions n'est disponible sur le site public.
- [x] 1-6 Ambiance, Playlist, Respiration, Pause, Lecture, Inspiration : existantes, vérifiées, moteur et séances partagés.
- [ ] 7 Mon petit jardin — développé en labo, testé ; design et intégration publique à faire.
- [ ] 8 Atelier de dessin — développé en labo, testé ; migration à passer ; design et intégration à faire.
- [ ] 9 Coloriage — idem (4 dessins créés pour le prototype).
- [ ] 10 Puzzle photo — idem.
- [ ] 11 Tangram — idem (3 silhouettes vérifiées).
- [ ] 12 Fenêtre d'ambiance — idem.
- [ ] 13 Mes ambiances — idem.
- [ ] 14 Arrêt audio progressif — capacité du moteur, interface dans « Mes ambiances ».
- [ ] 15 J'ai cinq minutes — idem.

### Plus tard — idées de Damien précisées avec Codex
- [ ] **Hydratation** : ajouter un verre en un geste, suivre sa progression et choisir son propre objectif quotidien, sans imposer une quantité universelle.

<details>
<summary>Prompt futur — Hydratation</summary>

```text
Objectif
Suivre l’eau bue avec un objectif choisi par l’utilisateur.

Contexte
Idée de Damien conservée pour plus tard. Le widget n’existe pas. Appliquer le contrat commun Study d'IDEES.md : sécurité, conservation des données et tests. Cette idée est hors priorité Study V1 et attend une demande explicite.

Décisions et réalisation
Ajouter un volume en un geste, proposer des contenances modifiables, corriger une saisie et afficher le total du jour. Enregistrer des unités cohérentes et gérer le changement de jour local.

À ne pas faire
Pas d’objectif universel obligatoire, de conseil médical ou de notification dans ce lot.

Vérifications et résultat attendu
Tester ajout/annulation, contenances, minuit et sauvegarde ; rendre captures et tests. Expliquer les changements en français simple et distinguer ce qui a été réellement exécuté.

Pas de commit ni de push sans un nouveau « commit push » de Damien.
```

</details>
- [ ] **Rappels pour boire** : notifications facultatives et réglables par l'utilisateur. Vérifier les autorisations et le fonctionnement en arrière-plan sur les téléphones ciblés avant de promettre des rappels fiables.

<details>
<summary>Prompt futur — Rappels d’hydratation</summary>

```text
Objectif
Proposer des rappels facultatifs, après construction du suivi d’hydratation.

Contexte
Les notifications en arrière-plan ne sont pas garanties par un simple timer de page. Appliquer le contrat commun Study d'IDEES.md : sécurité, conservation des données et tests. Cette idée est hors priorité Study V1 et attend une demande explicite.

Décisions et réalisation
Vérifier les possibilités réelles sur les appareils visés, puis proposer une solution avec horaires, fuseau, période silencieuse et désactivation. Demander l’autorisation au bon moment. Distinguer clairement rappels en page ouverte et notifications push réellement prises en charge, avec besoin de serveur éventuel.

À ne pas faire
Ne pas promettre des notifications fiables à partir d’un timer navigateur, ni demander l’autorisation dès l’arrivée sur le site.

Vérifications et résultat attendu
Tester refus, retrait d’autorisation, changement d’heure et appareil réellement supporté ; rendre coûts, limites et résultats réels. Expliquer les changements en français simple et distinguer ce qui a été réellement exécuté.

Pas de commit ni de push sans un nouveau « commit push » de Damien.
```

</details>
- [ ] **Suivi des calories** : idée évoquée par Damien, à garder pour plus tard. Codex recommande de ne pas l'inclure dans le prototype : aliments, portions et fiabilité des chiffres représentent un chantier distinct. La réserve déjà notée plus haut sur calories/sport/poids reste conservée.

<details>
<summary>Prompt futur — Calories — étude avant construction</summary>

```text
Objectif
Évaluer plus tard un suivi nutritionnel sans élargir la V1 Study.

Contexte
Idée de Damien reportée. La qualité des aliments, portions et données reste à établir. Appliquer le contrat commun Study d'IDEES.md : sécurité, conservation des données et tests. Cette idée est hors priorité Study V1 et attend une demande explicite.

Décisions et réalisation
Décrire un petit périmètre de saisie/correction, identifier une source de données avec droits et coûts vérifiés, et présenter au maximum deux approches. Expliquer ce qui est estimé et ce qui est saisi. Ne construire qu’après validation de ce périmètre et du budget.

À ne pas faire
Pas de promesse de précision depuis une simple photo, de régime personnalisé médical ni d’intégration payante non autorisée.

Vérifications et résultat attendu
Si la réalisation est autorisée, tester portions, unités, corrections et confidentialité ; rendre les hypothèses et limites sans fausse précision. Expliquer les changements en français simple et distinguer ce qui a été réellement exécuté.

Pas de commit ni de push sans un nouveau « commit push » de Damien.
```

</details>

Recommandation Codex : garder un espace simple pour travailler puis décompresser, sans multiplier les gadgets ni transformer immédiatement Renzvi en application de santé.

## Study — idées et prompts de réalisation (7 novembre 2026)

**Origine :** échanges de Damien avec Codex. Le cahier central, l'import de cours/photos, l'IA, la roulette de schémas et le besoin d'un guide viennent de Damien ; Codex propose les liens entre les outils et les choix de réalisation. Les références Anki, RemNote, Quizlet, Knowt, StudyFetch, NotebookLM et Obsidian servent à étudier des usages, jamais à copier leurs interfaces. Les sites commerciaux n'ont pas tous pu être revérifiés ; aucune limite ou offre concurrente n'est garantie actuelle.

**Promesse de travail :** « J'importe mon cours une fois, puis mes outils de révision se remplissent autour. » Ne pas demander de recopier tout le cours pour profiter de chaque widget.

### Périmètre et ordre recommandé

| Lot | État | Résultat | Prérequis |
|---|---|---|---|
| S1 | [x] En ligne le 9 nov. | Cahier central, matières/chapitres, import texte et PDF textuel, sources privées | Authentification existante |
| S2 | [x] En ligne le 9 nov. | Flashcards et textes à trous reliés au cours, sans API | S1 |
| S3 | [x] En ligne le 9 nov. | Révisions du jour et répétition espacée | S2 |
| S4 | [x] En ligne le 9 nov., fournisseur simulé | Crédits et garde-fous du moteur IA, testé avec un fournisseur simulé | S1 ; avant toute activation IA |
| S5 | [x] En ligne le 9 nov., fournisseur simulé | Génération de résumés/cartes depuis les chapitres et explication d'un passage | S1, S2, S4 |
| S6 | [x] En ligne le 9 nov., caché (?labo=1) | Quiz et retour automatique sur les erreurs | S2 ; S4/S5 pour les questions générées |
| S7 | [x] En ligne le 9 nov., caché (?labo=1) | Schémas masqués et tirage aléatoire | S1, S3 pour la planification |
| S8 | [x] En ligne le 9 nov., caché (?labo=1) | Guide Study contextuel et première séance accompagnée | Commencer avec S1 ; compléter au fil des lots |
| S9 | [ ] Reporté | Photos/PDF scannés et gros imports de plusieurs cahiers | S1, S4, S5 validés sur petits volumes |
| S10 | [ ] Reporté par Damien | Synthèse audio | Cours et résumés fiables, coûts mesurés |

Un lot = une tâche et une validation. Ne pas lancer dix chantiers en même temps. Le premier parcours doit fonctionner sur **un chapitre**, puis être élargi.

### Contrat commun aux prompts

Chaque bloc ci-dessous se colle seul à Claude Code. Lire aussi ce contrat et la section concernée dans le repo :

- Vérifier `git status`, récupérer `origin/main` et lire `CLAUDE.md`, `memoire.md` et le code concerné. Préserver les modifications existantes ; aucun écrasement ou reset.
- Le dernier brief explicite de Damien prime sur les anciennes recommandations de priorité. Ici, il demande une préparation de Study ; aucun lot n'est lancé par la seule présence du prompt.
- Garder le site statique HTML/CSS/JS et Supabase. Pour Study, recommander des modules dédiés, sans migration globale vers Next.js. Les dossiers ou modèles de données nouveaux ci-dessous sont **à créer**, pas prétendument présents.
- Réutiliser les pages Study/Chill, les tailles, le déplacement, les fonds et le catalogue `WIDGETS`. Un grand cahier est un widget du moodboard avec agrandissement possible, pas une app séparée qui remplace le dashboard.
- Recommandation de données : cours, chapitres, documents versionnés, cartes, questions et tentatives avec identifiants stables. Le stockage et les tables Study seront dédiés et privés. Ne pas mettre un PDF, toutes ses pages ou toutes les cartes dans la ligne `widget_state` limitée à 64 Ko. Y garder uniquement la petite configuration des widgets, comme la sélection active. Étendre la contrainte des identifiants de widgets seulement si nécessaire.
- Chaque carte/question garde son document, sa version et son passage/page source quand il existe. Une modification du document doit signaler les liens devenus incertains, pas pointer silencieusement vers une autre réponse.
- Sécurité Supabase : propriétaires explicites, RLS et stockage privé ; vérifier les accès entre deux comptes. Ne jamais exposer une clé secrète dans le navigateur. Ne pas exécuter le contenu HTML/JavaScript de documents importés et ne pas traiter un cours comme une instruction pour l'assistant.
- Utiliser `design-taste-frontend` pour les écrans, avec la procédure écrans d'app. Garder le verre et les variables CSS ; les choix de design doivent être montrés à Damien. Ne pas refondre la landing dans un lot Study.
- Avant tout appel payant : tarif et identifiant exact du modèle vérifiés, coût mesuré sur de vrais exemples, limites par utilisateur et plafond global. Ne pas activer un fournisseur tant que ces conditions et les accès nécessaires ne sont pas réunis ; terminer et tester avec un fournisseur simulé entre-temps. Ne jamais demander une valeur secrète dans le chat.
- Tester dans un vrai navigateur, au minimum à 320, 390, 768 et 1440 px ; clavier, toucher, erreurs de chargement/sauvegarde et rechargement. Ajouter des tests des nouveaux comportements et exécuter les suites existantes pertinentes.
- Rendre : fonctionnement en français simple, captures, résultats réellement exécutés, limites et étapes de configuration restantes. Ne pas déclarer une migration appliquée ou une fonction en production sur la seule présence de fichiers.
- Prendre en charge les choix techniques courants et les expliquer simplement ; ne pas demander à Damien de choisir un schéma de données ou une bibliothèque. Lui réserver les décisions de produit/design et les autorisations ou accès réellement manquants.
- Aucun commit, push, déploiement ou appel payant non autorisé. Attendre un nouveau « commit push » de Damien pour publier le lot.

### S1 — [x] Cahier numérique central et import unique

**Idée de Damien.** Un grand cahier au milieu du moodboard. Les cours alimentent les outils autour. Première version : texte et PDF dont le texte peut être extrait ; les photos et PDF scannés sont traités en S9.

```text
Objectif
Permettre d'importer un cours une fois, le lire dans un grand widget Cahier et retrouver ses chapitres.

Contexte
Appliquer le contrat commun Study d'IDEES.md. Le dashboard actuel est dans site/dashboard.html ; il contient WIDGETS, les pages Study/Chill et la personnalisation. Ne pas reconstruire ces fonctions.

Décisions déjà prises
Garder HTML/CSS/JS + Supabase. Recommandation : modules Study dédiés, tables de métadonnées et stockage privé pour les documents. Matières, cours et chapitres ont des identifiants stables. Le widget mémorise le cours ouvert ; les gros contenus ne vont pas dans widget_state.

À faire
Créer le widget Cahier, utilisable dans la grille et agrandissable, avec sélection du cours et des chapitres, recherche et reprise à la dernière position. Importer du texte ou un PDF textuel, conserver l'original et permettre de corriger les titres/chapitres proposés. Pour les PDF, utiliser un lecteur/extracteur maintenu tel que PDF.js, avec version et licence vérifiées et dépendances servies localement ; conserver la couche de texte et les références de pages pour les sélections futures. Ne pas recopier le document avec l'IA.
Proposer des limites configurables ; point de départ à valider par les tests : 20 Mo et 200 pages par PDF, extraction progressive annulable. Si le texte manque ou est inutilisable, expliquer la limite et conserver l'original, sans inventer un cours extrait.

À ne pas faire
Pas d'OCR, d'assistant, de paiement ou d'éditeur de traitement de texte complet. Pas d'ouverture publique des documents. Ne pas modifier l'original en corrigeant un titre ou une note.

Vérifications
Texte et PDF multipage, accents, ordre de lecture imparfait, document vide/scanné/trop lourd, arrêt en cours d'import, rechargement, suppression et accès interdit depuis un autre compte. Vérifier sélection, recherche et lecture mobile ainsi que les widgets voisins.

À me rendre
Une démonstration sur un chapitre, captures du cahier dans le moodboard, schéma simple des données et migrations/configuration nécessaires, résultats réels des tests et limites de l'extraction.
Pas de commit ni de push sans mon nouveau « commit push ».
```

### S2 — [x] Flashcards et textes à trous reliés au cahier

**Idée de Damien, précisée avec Codex.** Création depuis un passage et import d'un paquet simple pour limiter la ressaisie. L'IA viendra alimenter ce même moteur, pas un deuxième widget concurrent.

```text
Objectif
Créer, corriger et réviser des cartes liées à un cours, sans appel IA.

Contexte
Appliquer le contrat commun Study d'IDEES.md. S1 doit être utilisable. Les cartes appartiennent à une matière/un chapitre et peuvent référencer une sélection précise du cours.

Décisions déjà prises
Deux types au départ : question/réponse et texte à trous. Recommandation : cartes et paquets dans des tables dédiées, version de contenu conservée pour les corrections, petite configuration du widget dans widget_state.

À faire
Depuis une sélection du cahier, proposer « Créer une carte » avec le passage prérempli ou « Masquer ces mots ». Éviter de recopier le texte. Ajouter une création manuelle courte et un import CSV UTF-8 question/réponse avec aperçu, validation et détection des doublons ; ne pas annoncer la compatibilité Anki complète.
Créer un widget Flashcards : choix du paquet, question, révélation de réponse et lien « Revoir dans le cours ». Permettre correction, suppression et reprise. Une modification significative d'une carte doit conserver les anciennes tentatives sans les présenter comme des réponses à sa nouvelle version. Fournir une interface de réponses compatible avec le futur ordonnanceur S3.

À ne pas faire
Pas de génération payante, d'import .apkg complexe ni de copie du cours complet dans chaque carte. Ne pas interpréter le HTML provenant d'un CSV comme du code.

Vérifications
Créer dix cartes, importer des accents/guillemets/sauts de ligne, gérer doublons et lignes invalides, modifier une carte, revenir au passage source, recharger et empêcher l'accès entre comptes. Tester le widget en trois tailles et au clavier.

À me rendre
Parcours complet de création et révision, format CSV accepté, captures, tests et limites. Indiquer ce qui attend S3.
Pas de commit ni de push sans mon nouveau « commit push ».
```

### S3 — [x] Révisions du jour et répétition espacée

**Proposition Codex.** Remplir automatiquement la prochaine séance à partir des réponses, sans demander un planning manuel ni un appel IA à chaque carte.

```text
Objectif
Montrer les cartes à revoir aujourd'hui et programmer leur prochaine révision à partir des réponses.

Contexte
Appliquer le contrat commun Study d'IDEES.md. Réutiliser les cartes et paquets de S2. Ce moteur servira aussi aux schémas de S7.

Décisions déjà prises
Aucun appel IA pour planifier ou consulter les révisions. Recommandation : évaluer une bibliothèque FSRS maintenue, par exemple ts-fsrs, vérifier version/licence/compatibilité avec le site statique, puis réutiliser son algorithme plutôt qu'inventer des intervalles présentés comme scientifiques.

À faire
Créer le widget Révisions du jour et une séance par cours ou tous cours confondus. Enregistrer chaque tentative et la prochaine échéance. Proposer des libellés compréhensibles pour les réponses de l'ordonnanceur, par exemple À revoir, Difficile, Bien et Facile. Montrer le résultat d'une séance et un lien vers les difficultés.
Gérer dates, fuseau de l'utilisateur, reprise, nouveaux contenus, retard et double-clic sans doubler les tentatives. Les échéances sont persistées ; recharger ou ouvrir deux onglets ne doit pas réinitialiser la progression. Les statistiques décrivent des révisions observées, pas une maîtrise scolaire certifiée.

À ne pas faire
Pas de moteur IA, de notifications ou de pourcentage de réussite inventé. Ne pas pénaliser la suppression d'une carte ni dupliquer toute la banque de cartes dans la file du jour.

Vérifications
Dates simulées, changement de jour/fuseau, cartes en retard, réponse répétée, deux onglets, carte modifiée/supprimée, séance interrompue et reprise après rechargement. Vérifier qu'aucune requête vers un fournisseur IA n'est émise.

À me rendre
Règles retenues, démonstration sur plusieurs jours simulés, captures et tests. Expliquer les limites de la planification.
Pas de commit ni de push sans mon nouveau « commit push ».
```

### S4 — [x] Crédits et protection du moteur IA

**Direction discutée avec Damien, encore à calibrer.** Tous les plans pourraient accéder aux mêmes outils, avec des volumes d'IA différents. Consulter les résultats et réviser ne consommerait pas de nouveaux crédits. Essai limité ou gratuit permanent : pas encore tranché. 7,90 € / 15,90 € et un palier supérieur à 30 € restent des hypothèses ; aucune remise annuelle de 50 % n'est validée par un calcul de coûts.

```text
Objectif
Préparer une consommation IA contrôlée avant de connecter un modèle payant.

Contexte
Appliquer le contrat commun Study d'IDEES.md. Le site n'a actuellement ni backend IA, ni portefeuille de crédits, ni paiement. Ne pas présenter les prix de la landing comme un abonnement déjà actif.

Décisions déjà prises
Recommandation : fonctions serveur Supabase avec authentification vérifiée et opérations de crédit atomiques côté base. Le navigateur ne choisit ni son solde, ni son coût, ni son utilisateur facturé. Commencer avec un fournisseur simulé.

À faire
Créer un journal de crédits par utilisateur, des travaux avec identifiant d'idempotence et les états en attente/en cours/réussi/échoué/annulé. Réserver un budget avant traitement, rapprocher le débit de la règle affichée et éviter tout double-débit lors d'un rejeu. Comptabiliser aussi les dépenses fournisseur réelles lorsqu'une tentative échoue ; ne pas les masquer.
Limiter entrées/sorties, travaux concurrents, nouvelles tentatives, dépense par utilisateur et budget global. Afficher l'estimation et le plafond avant une opération coûteuse. Appliquer des limites de fréquence et une vérification d'email avant crédits de découverte, sans considérer une IP partagée comme une preuve de fraude.
Les résultats enregistrés restent lisibles sans crédit. Une indisponibilité fournisseur ne doit pas perdre le cours. Préparer des tests de configuration des offres, sans brancher de paiement dans ce lot.

À ne pas faire
Pas de secret dans le navigateur, pas de quota seulement local, pas d'IA illimitée, pas de prix fournisseur supposé actuel, pas d'activation payante.

Vérifications
Double-clic, appels concurrents, solde insuffisant, timeout, retries bornés, interruption, budget global atteint et tentative de modifier le coût depuis le navigateur.

À me rendre
Règles compréhensibles, migrations et configuration nécessaires, journal d'exemples simulés, tests et points encore à calibrer avec les coûts.
Pas de commit ni de push sans mon nouveau « commit push ».
```

### S5 — [x] Génération réutilisable depuis le cours et aide sur un passage

**Idée de Damien.** Le cahier est la source ; résumés, cartes, quiz et explications réutilisent le texte déjà extrait. Une nouvelle génération reste un appel payant, même si l'extraction n'est pas refaite. Le résumé est une action du cahier, pas nécessairement un nouveau widget.

```text
Objectif
Depuis un chapitre ou une sélection du cahier, créer un résumé ou des flashcards modifiables, puis permettre une explication ciblée.

Contexte
Appliquer le contrat commun Study d'IDEES.md. S1, S2 et S4 sont requis. Les cartes générées rejoignent le même moteur que les cartes manuelles.

Décisions déjà prises
Appels exclusivement côté serveur, par travaux plafonnés. Réutiliser texte, document et version déjà importés ; travailler par chapitre, pas renvoyer tous les cahiers à chaque question. Le modèle et son tarif exact seront vérifiés au moment de l'intégration. Flash-Lite est un candidat à évaluer, pas un gagnant ni une disponibilité garantie ; « Haiku 5.5 » n'a pas été confirmé.

À faire
Préparer une interface fournisseur remplaçable et commencer avec sa simulation. Comparer un petit modèle sur trois cours représentatifs : définitions, cours rédigé et formules. Mesurer coût d'entrée/sortie et éventuels tokens facturés supplémentaires, erreurs, retries et qualité en français.
Produire des objets validés : question/réponse, passage/page source, résumé relié aux sources. Mettre les cartes en aperçu avant ajout. Une citation doit correspondre au document, pas seulement être une page inventée par le modèle. Signaler ce que le cours ne permet pas de répondre. Limiter l'historique envoyé à l'assistant ; inclure uniquement le contexte nécessaire et vérifié accessible au compte.
Conserver les résultats et éviter les générations identiques accidentelles. Prévoir une option explicite de régénération et son coût. Distinguer une explication ajoutant un exemple extérieur d'une information réellement présente dans le cours.

À ne pas faire
Pas d'OCR de 200 photos, de recherche web implicite, de modèle « le moins cher du marché » non vérifié, ni de consommation payante avant validation des accès et du budget.

Vérifications
Contenu absent, sortie mal formée, document tentant de donner des instructions à l'assistant, mauvais accès, citations incorrectes, cours long tronqué, double demande, correction et reprise. Réviser une carte existante ne doit appeler aucun modèle.

À me rendre
Démonstration, échantillons avec corrections nécessaires, coûts mesurés ou explicitement simulés, modèle testé, limites et tests.
Pas de commit ni de push sans mon nouveau « commit push ».
```

### S6 — [x] Quiz et retour automatique sur les erreurs

**Proposition Codex adoptée dans le périmètre Study.** Un seul fonds de questions ; plusieurs façons de s'entraîner. Éviter un cahier d'erreurs à remplir à la main.

```text
Objectif
Permettre de se tester sur un chapitre et retrouver automatiquement les questions ratées avec leurs corrections et sources.

Contexte
Appliquer le contrat commun Study d'IDEES.md. Réutiliser cours, cartes, tentatives et versions. La génération de questions dépend de S4/S5 ; fournir aussi des questions manuelles/importées pour tester sans fournisseur.

Décisions déjà prises
Un widget Quiz et une vue À revoir liée aux tentatives, sans copie divergente du cours. Premier type : QCM dont les réponses attendues sont stockées et validables avant la séance. La correction locale d'un QCM ne demande pas de nouvel appel IA.

À faire
Choisir matière/chapitre et longueur de séance, masquer la correction avant réponse, afficher ensuite explication et passage source. Enregistrer les tentatives, alimenter les difficultés et permettre une séance ciblée. Varier l'ordre sans associer une bonne réponse au mauvais libellé. Conserver l'historique lorsque l'énoncé change et permettre de signaler/corriger une question erronée.
Pour une réponse libre, afficher une réponse attendue et une auto-évaluation ; ne pas prétendre comprendre une réponse avec une simple comparaison de chaînes. Une correction sémantique par IA serait une opération explicite et comptée, hors correction gratuite du QCM.

À ne pas faire
Pas de « note scolaire certifiée », pas de correction IA automatique à chaque clic et pas de recopies manuelles imposées pour remplir la liste d'erreurs.

Vérifications
Plusieurs bonnes réponses si ce type est pris en charge, mélange des choix, question corrigée/supprimée, séance interrompue, répétition d'une erreur, sources, rechargement et refus d'accès entre comptes.

À me rendre
Séance complète, retour sur les erreurs, captures, tests et limites de correction.
Pas de commit ni de push sans mon nouveau « commit push ».
```

### S7 — [x] Schémas masqués avec une « roulette » de questions

**Idée de Damien, précisée avec Codex.** Tirer au hasard les légendes à cacher parmi des zones pertinentes déjà identifiées. Pas de rectangles quelconques sur l'image. La détection automatique viendra après la version manuelle.

```text
Objectif
Réviser un schéma sans le recopier : masquer une légende tirée au hasard, chercher la réponse, la révéler et indiquer Trouvé ou À revoir.

Contexte
Appliquer le contrat commun Study d'IDEES.md. Utiliser une image du cours ou un extrait de page depuis S1 ; raccorder les réponses au moteur S3 lorsqu'il est disponible.

Décisions déjà prises
La première version ne demande pas d'IA. L'utilisateur encadre une fois les légendes et peut ajouter une réponse textuelle facultative. L'image originale reste intacte. Stocker les zones en coordonnées normalisées pour les conserver au redimensionnement.

À faire
Créer une édition tactile/clavier adaptée pour ajouter, ajuster et supprimer les zones. Fournir « Interroge-moi » : choisir parmi les zones définies, en évitant les répétitions immédiates quand plusieurs choix existent. Masquer une zone, révéler l'image originale sur demande et enregistrer la réponse de l'étudiant. Proposer ensuite plusieurs zones pour augmenter la difficulté. Les erreurs doivent pouvoir être revues dans une séance ciblée.
Garder le lien au document et à sa version. Si l'image ou le cadrage change, demander de vérifier les zones plutôt que les déplacer silencieusement sur une autre légende.

À ne pas faire
Pas de détection automatique ni d'appel IA à chaque tirage. Ne pas confondre texte visible sous un masque transparent et véritable question. Ne pas transmettre d'images privées à un service tiers sans opération explicite.

Vérifications
Zéro/une/plusieurs zones, orientation d'image, tailles de widget, téléphone, clavier, coordonnées après rechargement, tirage couvrant les zones et absence de réponse révélée avant action. Vérifier les accès au fichier privé.

À me rendre
Vidéo courte de la roulette, captures, tests et limites de l'éditeur.
Pas de commit ni de push sans mon nouveau « commit push ».
```

### S8 — [x] Guide Study et première expérience complète

**Demande de Damien.** Trop d'étapes manuelles empêcheraient d'exploiter les widgets. Le guide doit aussi supprimer des opérations et proposer des valeurs utiles, pas expliquer une interface compliquée.

```text
Objectif
Accompagner une première révision de bout en bout sans demander de configurer séparément chaque widget.

Contexte
Appliquer le contrat commun Study d'IDEES.md. Le premier lancement et l'installation de l'app existent déjà ; ce lot est un guide spécifique au cours et à la révision. Commencer avec S1 et enrichir le guide à mesure que les autres lots sont réellement disponibles.

Décisions déjà prises
Guide facultatif, court, contextuel et rejouable. Préserver le moodboard personnalisé. Une progression suit des actions réellement réussies, pas une succession de clics Suivant.

À faire
Proposer : ajouter un cours, vérifier son chapitre, choisir une action, puis réaliser une petite séance. Utiliser l'import pour préremplir ce qui peut l'être. Proposer d'ajouter les widgets nécessaires sur la page Study existante, sans écraser sa disposition, remplacer un cours ou démarrer un son. Au retour, proposer les révisions dues.
Offrir une explication au moment où elle sert, une aide accessible et la reprise après interruption. Si aucun document n'est disponible, proposer un exemple clairement identifié, jamais une fausse importation personnelle.
Distinguer lecture gratuite, résultat déjà enregistré et nouvelle opération consommant des crédits. Montrer les limites avant une opération, pas après l'envoi du cours.

À ne pas faire
Pas de dix écrans obligatoires, pas de tutoriel qui cache toute l'interface, pas de validation d'étape si l'import ou la sauvegarde échoue. Ne pas afficher comme disponible un lot non construit.

Vérifications
Ignorer/rejouer, reprendre après rechargement, ancien utilisateur avec page remplie, échec d'import, crédits indisponibles, clavier, toucher et mouvement réduit. Faire exécuter une première séance avec un minimum d'explications externes et noter les points de blocage.

À me rendre
Parcours filmé, captures, nombre d'actions réellement nécessaires, tests et difficultés restantes.
Pas de commit ni de push sans mon nouveau « commit push ».
```

### S9 — [ ] Photos, PDF scannés et import de plusieurs cahiers — plus tard

**Idée de Damien.** Traiter à terme des lots de l'ordre de 200 photos, avec plusieurs cahiers. Un PDF scanné appartient à ce parcours, même si son extension est .pdf. Le coût n'est pas déterminé par le nombre de fichiers seulement.

```text
Objectif
Numériser plusieurs cahiers photographiés de manière contrôlée, en gardant les originaux et les passages incertains.

Contexte
Appliquer le contrat commun Study d'IDEES.md. Ce lot est reporté jusqu'à validation de l'import textuel, des sources et des protections IA de S1/S4/S5. Ne pas le lancer avec le MVP du cahier.

Décisions déjà prises
Imports par travaux en arrière-plan, photos regroupées en matières/cahiers, ordre corrigeable, estimation avant confirmation. Pas de traitement des 200 photos en une seule demande au modèle.

À faire
Contrôler type, dimensions, orientation, poids, doublons et qualité ; signaler les pages floues ou coupées. Proposer un essai sur quelques pages avant le lot complet. Comparer OCR et modèle vision sur les documents représentatifs, avec leurs coûts réels, puis recommander une solution. Conserver une transcription corrigible, les sources et les incertitudes ; ne pas inventer ce qui est illisible.
Prévoir une file durable côté serveur, des points de reprise par page, des retries bornés et des états consultables après fermeture du navigateur. Définir des limites mesurées et une annulation qui arrête les travaux non démarrés en expliquant ceux déjà engagés. Le compte ne doit pas payer deux fois pour un rejeu technique du même travail.

À ne pas faire
Pas de promesse de lecture parfaite de toute écriture, pas de gros traitement gratuit illimité et pas de classification définitivement imposée à l'étudiant.

Vérifications
Petit lot puis lot de 200 fichiers de test, plusieurs cahiers, pages tournées, schémas/formules, déconnexion, interruption, annulation et coût partiellement consommé. Aucun appel payant massif avant validation du budget.

À me rendre
Coût et qualité mesurés, limites, démonstration de reprise, tests et erreurs restantes.
Pas de commit ni de push sans mon nouveau « commit push ».
```

### S10 — [ ] Écouter une synthèse — explicitement reporté

**Décision de Damien : plus tard.** Ne pas ajouter d'audio généré pendant la construction des autres lots.

```text
Objectif
Lorsque Damien relancera ce lot, écouter une synthèse déjà vérifiée d'un chapitre sans régénérer le cours à chaque lecture.

Contexte
Appliquer le contrat commun Study d'IDEES.md. Cette idée est reportée ; le simple fait de lire ce prompt n'autorise pas sa réalisation. S1 et des résumés sourcés fiables sont requis.

Décisions déjà prises
Génération explicite et plafonnée, texte visible et modifiable, audio conservé avec sa version source. Lecture uniquement après une action de l'utilisateur. Vérifier les droits et tarifs des voix au moment du choix.

À faire
Proposer un lecteur dans le cahier avec lecture/pause, progression et vitesse. Conserver les audios pour éviter une nouvelle facture à chaque écoute et signaler un résumé modifié nécessitant une nouvelle version. Gérer la concurrence avec la playlist et l'ambiance sans déclencher de sons inattendus. Fournir accès privé et suppression cohérente avec le cours.

À ne pas faire
Pas de lancement automatique, pas de clonage de voix, pas de conversation audio temps réel dans ce lot, pas d'appel payant avant coût et quota validés.

Vérifications
Accès privé, erreurs fournisseur, génération répétée, lecture/reprise, changement de version et interaction avec les autres lecteurs sur mobile. Distinguer les essais navigateur des vrais téléphones.

À me rendre
Démonstration, coût réel de génération et stockage, tests et limites.
Pas de commit ni de push sans mon nouveau « commit push ».
```

### Pistes d'extension Study conservées, hors périmètre initial

Ces propositions Codex ne sont pas des tâches à lancer maintenant : planning de révision, emploi du temps importable, moyenne et coefficients, entraînement à l'oral, frise chronologique, vocabulaire et examen blanc. Leur intérêt sera réévalué après un premier parcours complet ; éviter la saisie répétitive. Les données et types d'exercices du moteur commun doivent permettre de futures vues sans recréer un système indépendant pour chaque widget.

#### [ ] Planning de révision — hors V1 initiale

```text
Objectif : répartir les chapitres déjà importés avant une date d'examen, sans ressaisir le cours.
Contexte : appliquer le contrat commun Study ; utiliser matières/chapitres S1, échéances renseignées et progression observée. Attendre une demande explicite pour cette extension.
Décisions et réalisation : demander seulement les informations manquantes, comme la date et les jours disponibles. Proposer un planning modifiable, gérer les séances manquées et le rééquilibrage. Séparer ce planning de travail des échéances de cartes calculées par S3 ; ne pas écraser leur historique. Respecter une charge choisie par l'étudiant.
À ne pas faire : pas de promesse de réussite à l'examen, de calendrier rempli de tâches irréalisables ou d'appel IA nécessaire pour répartir les séances.
Vérifications : peu de jours disponibles, retard, chapitre supprimé, examen déplacé, fuseau et rechargement.
À me rendre : règles, captures du planning dans le moodboard, tests et limites.
Pas de commit ni de push sans un nouveau « commit push ».
```

#### [ ] Emploi du temps importable — hors V1 initiale

```text
Objectif : retrouver ses cours du jour depuis un export fourni par son établissement.
Contexte : appliquer le contrat commun Study et réutiliser le prompt Google Agenda si une connexion devient nécessaire. Ne pas demander les identifiants du portail scolaire.
Décisions et réalisation : commencer par un import ICS avec aperçu, récurrences, fuseaux, salles et mise à jour des événements déjà importés. Garder le fichier privé, filtrer les champs affichés et distinguer données importées et modifications locales. Relier facultativement un événement à une matière existante.
À ne pas faire : pas de scraping d'un portail privé ni de promesse de synchronisation permanente à partir d'un fichier ponctuel.
Vérifications : réimport, changement d'heure, événements annulés, horaires de nuit et fichier mal formé.
À me rendre : formats acceptés, captures, tests et limites. Construire seulement sur nouvelle demande de Damien.
Pas de commit ni de push sans un nouveau « commit push ».
```

#### [ ] Moyenne et coefficients — hors V1 initiale

```text
Objectif : suivre une moyenne et simuler une note cible avec le moins de saisie possible.
Contexte : appliquer le contrat commun Study ; les établissements n'utilisent pas tous les mêmes règles de calcul. Attendre une demande explicite.
Décisions et réalisation : importer un CSV de notes et coefficients avec aperçu ; permettre les corrections manuelles et le choix du barème. Afficher la formule et séparer résultats enregistrés et simulations. Une moyenne prévue par ce widget reste un calcul fondé sur les règles renseignées, pas la note officielle de l'établissement.
À ne pas faire : pas d'IA nécessaire, de récupération d'identifiants scolaires ou de moyenne prétendument officielle à partir de données incomplètes.
Vérifications : notes manquantes, coefficients nuls/invalides, barèmes différents, arrondis et doublons d'import.
À me rendre : exemple de fichier, règle de calcul, captures et tests.
Pas de commit ni de push sans un nouveau « commit push ».
```

#### [ ] Entraînement à l'oral — hors V1 initiale

```text
Objectif : s'entraîner sur un sujet du cours avec préparation et réponse chronométrées.
Contexte : appliquer le contrat commun Study ; réutiliser les questions S6 ou les sujets fournis, pas une banque à recopier entièrement. Attendre une demande explicite.
Décisions et réalisation : tirer un sujet, lancer les phases et révéler ensuite les points attendus et leurs sources. Proposer une auto-évaluation. Un enregistrement vocal peut être une option volontaire, avec permission au clic, aperçu, suppression et accès privé. Ne pas confondre cet enregistrement avec la synthèse audio S10 reportée.
À ne pas faire : pas de note automatique fondée sur un simple enregistrement, de transcription ou d'analyse vocale payante implicite.
Vérifications : microphone refusé, phase interrompue, durée fiable en arrière-plan, suppression et mobile.
À me rendre : démonstration, tests et limites de stockage/enregistrement.
Pas de commit ni de push sans un nouveau « commit push ».
```

#### [ ] Frise chronologique — hors V1 initiale

```text
Objectif : réviser des événements dans leur contexte chronologique.
Contexte : appliquer le contrat commun Study ; alimenter la frise depuis des événements importés ou sélectionnés dans le cours, sans exiger une seconde copie du chapitre.
Décisions et réalisation : proposer un import CSV date/événement/source, un aperçu corrigeable et une frise adaptée au mobile. Ajouter un exercice de remise en ordre réutilisant les tentatives du moteur commun. Conserver les dates approximatives et périodes comme telles. Une extraction IA éventuelle utilise S4/S5 et ses crédits.
À ne pas faire : pas d'invention de date précise à partir d'une période vague et pas d'appel IA à chaque affichage.
Vérifications : même date pour plusieurs événements, périodes, dates avant notre ère si prises en charge, ordre ambigu et sources.
À me rendre : périmètre de dates supporté, captures et tests. Attendre une demande explicite.
Pas de commit ni de push sans un nouveau « commit push ».
```

#### [ ] Vocabulaire — hors V1 initiale

```text
Objectif : réviser le vocabulaire d'un cours sans recréer un second moteur de flashcards.
Contexte : appliquer le contrat commun Study et réutiliser S2/S3. Un paquet de vocabulaire peut être un modèle de cartes plutôt qu'un nouveau widget.
Décisions et réalisation : importer mot/traduction/exemple via CSV ou sélectionner une liste existante. Autoriser les deux sens de révision et plusieurs réponses acceptées. Conserver accents et langue. Toute traduction générée doit être corrigeable et passer par les crédits S4/S5.
À ne pas faire : pas de dictionnaire récupéré sans droits vérifiés, de score sémantique basé sur une égalité stricte ou de doublon de l'ordonnanceur.
Vérifications : sens inversé, accents, variantes de réponse, import, sources et échéances.
À me rendre : choix modèle de cartes/widget expliqué, captures et tests. Attendre une demande explicite.
Pas de commit ni de push sans un nouveau « commit push ».
```

#### [ ] Examen blanc — hors V1 initiale

```text
Objectif : s'entraîner dans une durée définie sur les questions et exercices déjà disponibles.
Contexte : appliquer le contrat commun Study ; réutiliser la banque S6. Construire seulement après validation des quiz et sur demande de Damien.
Décisions et réalisation : sélectionner chapitres, questions et durée, garder les corrections cachées jusqu'à remise, conserver les réponses et afficher ensuite les explications et difficultés. Définir les règles de pause et de reprise ; utiliser une heure de fin fiable et une remise idempotente. Une question libre peut être auto-évaluée, sans fausse note automatique.
À ne pas faire : pas de surveillance de l'élève, de certification scolaire, d'appel IA pendant chaque réponse ou de banque d'examens copiée sans droits.
Vérifications : délai écoulé, double remise, fermeture/reprise, question modifiée en cours et correction des réponses.
À me rendre : parcours complet, règles, captures et tests.
Pas de commit ni de push sans un nouveau « commit push ».
```

### Questions commerciales encore ouvertes

- Damien envisage tous les widgets accessibles dans tous les plans, avec des limites de consommation IA ; la répartition exacte reste à trancher.
- Repères discutés : gratuit, 7,90 € et 15,90 € TTC/mois, éventuellement un palier au-dessus de 30 €. Aucun prix n'est testé ou branché à un paiement.
- Gratuit permanent avec crédits de découverte ou essai de courte durée : décision non prise. Sept ou quatorze jours ne sont pas des durées scientifiquement validées pour Renzvi.
- Recommandation Codex : ne fixer quotas, recharges et remise annuelle qu'après mesures des coûts et des usages. Une remise de 50 % a été envisagée par Damien, pas validée économiquement.
- Objectif de marge à définir précisément : revenu hors TVA moins coûts directs n'est pas le bénéfice net. Ne pas promettre 90 % sans calcul intégrant fournisseur, paiement et infrastructure.
