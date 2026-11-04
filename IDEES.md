# Idées Renzvi

Notées le 3 nov. 2026. Rien ici n'est décidé tant qu'il n'est pas dans CLAUDE.md.

## Le concept (précisé par Damien le 3 nov. 2026)
- **Renzvi = une seule app qui réunit tous les widgets** : study, sport, chill, ambiance, etc.
- On compose son dashboard avec les widgets qu'on veut, **comme un moodboard**.
- C'est ça qu'on vend. Aucune feature n'est la star : le ticket ci-dessous est un widget parmi d'autres.

## Widget : le ticket de vol de focus
- Un widget en forme de ticket d'avion. On le **déchire** (animation), ça lance un « vol » : la durée du focus = la durée du vol.
- Idée de départ : verrouiller le téléphone pendant le vol. **Impossible en PWA** (un site ne peut pas bloquer le téléphone). En app native c'est très limité : sur iPhone il faut une autorisation spéciale d'Apple (Temps d'écran), sur Android des permissions sensibles.
- Version PWA retenue : le vol est **annulé** si on quitte l'onglet ou l'appli avant l'arrivée. L'engagement vient de la règle, pas du blocage. La page ne doit jamais dire que ça verrouille le téléphone.
- Damien sait que ce genre de concept existe déjà sur TikTok : c'est la preuve que ça plaît. Le projet est une **grosse production** : le ticket doit être soigné, pas une copie.
- Plus tard, si ça prend : une vraie app native avec blocage (App Store 99 $/an, validation de plusieurs semaines).

## Autour du ticket
- Destination choisie, billet généré (Paris → Tokyo, 2 h 30).
- Carnet de voyages : tampons de passeport, statistiques de vols réussis.
- Sons d'ambiance (cabine d'avion, pluie, café), sons libres de droits.

## Public visé (à confirmer)
- Reco : étudiants et jeunes qui bossent. Prix bas (2 à 4 €/mois). Alternative : freelances.

## Features V1 proposées (sans coût par utilisateur)
- Dashboard avec photos de fond floutées.
- Minuteur focus et temps de focus de la semaine.
- Tâches du jour, habitudes avec séries, notes.
- Compte et synchro téléphone/ordi (Supabase).

## Plus tard (afficher « bientôt », ne pas promettre)
- Fiches de révision (type Anki), V2.
- Synchro Google Agenda (vérification Google = des semaines).
- Calories, sport, poids : déconseillé, chacun est une app entière.

## Gratuit / payant (à trancher)
- Gratuit : dashboard, minuteur, tâches, habitudes, 3 fonds.
- Pro : photos perso en fond, tous les sons, statistiques détaillées. Prix TTC.

## À faire ensuite
- Damien envoie ses designs Refero (référence d'ambiance, jamais une copie).
- Landing construite autour du dashboard moodboard (tout en une app), le ticket dans la vitrine des widgets, puis on développe les features.

## Décisions du 3 nov. 2026
- **V1 = deux modes : Study et Chill.** Sport arrive après (V1.5 : minuteur d'intervalles + 3-4 programmes en texte ; illustrations/3D bien plus tard).
- Un mode = un préréglage : fond + widgets + ambiance sonore + playlist, activé en un clic. Pack Study prêt à l'emploi à l'inscription.
- Musique : lecteur Spotify intégré (iframe) avec une playlist par mode, + alternative YouTube. Connexion Spotify complète plus tard, après vérification des règles actuelles de Spotify.
- Tarif envisagé : gratuit permanent limité + Pro avec essai de 14 jours sans carte (à confirmer).

## Idées en plus (non tranchées)
- Study : vol de groupe (invite un ami), escale = pause, vol longue distance pour les examens, compte à rebours d'examen, suivi par matière, carte de partage TikTok, mode « study with me » plein écran.
- Fiches de révision : saisie à la main d'abord, génération par IA ensuite, réservée au Pro avec plafond mensuel par utilisateur (coût à calculer avant de construire).
- Sport (plus tard) : séance = vol sport, repos = escale ; base d'exercices libre à vérifier (wger, free-exercise-db) ; avertissement santé obligatoire.

## Propositions Codex — widgets et mode Chill (4 nov. 2026)

Idées ajoutées par Codex à la demande de Damien, à partir de leur échange. Ce sont des pistes pour le prototype, pas des fonctionnalités décidées ou déjà disponibles. Les doublons avec les idées déjà notées sont conservés volontairement.

### Widgets proposés par Codex
- **Compte à rebours personnel** : examen, vacances ou événement, avec un titre et une date. Utilisable en Study comme en Chill. Déjà évoqué plus haut pour les examens ; proposition également faite par Codex.
- **Ambiance sonore** : mélanger pluie, forêt, café, feu de bois ou cabine d'avion, avec un volume par son. Utiliser des fichiers dont les droits permettent cet usage. Déjà évoqué plus haut ; proposition également faite par Codex pour renforcer Chill.
- **Mes raccourcis** : épingler ses liens vers les cours, documents, outils et sites favoris pour les retrouver sur le dashboard.
- **Tableau d'inspiration** : épingler quelques images avec de petites légendes pour rendre le dashboard plus personnel et renforcer le concept de moodboard.
- **Suivi de lecture** : choisir un livre, noter sa progression et conserver une citation ; un lien entre études et détente.
- **Playlist** : retrouver sa playlist Spotify ou YouTube dans un widget. Vérifier les possibilités et les règles des lecteurs intégrés avant de promettre leur fonctionnement. Déjà évoqué plus haut ; proposition également faite par Codex.

### Chill, détente et bien-être — propositions Codex
- **Respiration guidée** : un cercle qui s'agrandit et se réduit pour accompagner une respiration douce, pendant 1, 3 ou 5 minutes. Arrêt possible à tout moment. Un outil de détente, sans promesse médicale.
- **Pause détente** : choisir une courte pause (regarder au loin, relâcher les épaules, marcher un peu), accompagnée d'une animation et d'un petit compte à rebours.
- **Piste de priorité proposée par Codex** : respiration guidée et ambiance sonore pour donner une utilité immédiate au mode Chill. Le compte à rebours et le tableau d'inspiration restent des pistes pour le prototype. Ordre de développement à confirmer avec Damien.

### Plus tard — idées de Damien précisées avec Codex
- **Hydratation** : ajouter un verre en un geste, suivre sa progression et choisir son propre objectif quotidien, sans imposer une quantité universelle.
- **Rappels pour boire** : notifications facultatives et réglables par l'utilisateur. Vérifier les autorisations et le fonctionnement en arrière-plan sur les téléphones ciblés avant de promettre des rappels fiables.
- **Suivi des calories** : idée évoquée par Damien, à garder pour plus tard. Codex recommande de ne pas l'inclure dans le prototype : aliments, portions et fiabilité des chiffres représentent un chantier distinct. La réserve déjà notée plus haut sur calories/sport/poids reste conservée.

Recommandation Codex : garder un espace simple pour travailler puis décompresser, sans multiplier les gadgets ni transformer immédiatement Renzvi en application de santé.
