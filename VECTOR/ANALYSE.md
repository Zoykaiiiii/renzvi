# Analyse et reconstruction VECTOR

## Archive reçue

Nom : `1777127053283-night.zip`.

SHA-256 : `90688ccf874dc378300887fbe62217c22821068387b88d9bb225e91cf760d22f`.

Inventaire : 870 fichiers réguliers, sans lien symbolique ni chemin d’extraction sortant. L’original a été conservé sans modification. Aucun exécutable, script ou projet de compilation original n’a été lancé ; aucun fichier n’a été envoyé à un service d’analyse externe.

Les points d’entrée, accès mémoire, authentification, stockage, projets, configurations et modules de fonctionnalités ont été examinés. Des recherches de flux sensibles ont porté sur les sources ; les binaires fournis ont été inventoriés et inspectés statiquement. Cela ne constitue ni une exécution instrumentée ni une certification antivirus.

## Constats confirmés

- Aucun grabber de navigateur ou Discord, collecte de cookies, webhook d’exfiltration ou autorun n’a été identifié dans les sources examinées.
- Le module d’authentification pouvait transmettre les identifiants saisis et une empreinte machine à `getnight.wtf/api` au moyen de PowerShell. Son appel était commenté au démarrage, mais le code restait compilé.
- Les identifiants de ce module étaient sauvegardés en clair dans `%APPDATA%\night_auth\credentials.json`.
- Des routines anti-débogage/crash volontaire et de génération locale de stubs exécutables étaient présentes.
- Six bibliothèques/DLL précompilées Lua, FreeType et GLFW avaient une provenance non attestée. Les chaînes/imports examinés ne suffisent pas à déterminer leur innocuité.

Il serait donc inexact d’affirmer qu’un grabber prouvé a été retiré. La reconstruction retire les composants à risque identifiés et exclut tous les binaires reçus.

## Modifications de la reconstruction

- Authentification distante, stockage des identifiants, HWID et routines anti-analyse retirés.
- Lua dormant, uSynergy inutilisé, anciens projets et outils/scripts tiers inutilisés exclus.
- Aucun fichier exécutable ou bibliothèque précompilée d’origine n’est réutilisé. Le projet reconstruit les seules sources requises et lie les bibliothèques système Windows.
- Accès mémoire par ReadProcessMemory/WriteProcessMemory, droits limités, tailles et comptes d’octets contrôlés, handles fermés.
- Offsets utilisés migrés vers le dump fourni `version-f0ea5da9412f4e35`. Valeurs et provenance dans `offset-migration.json`. Le lien RenderView→VisualEngine inconnu n’est pas utilisé ; le pointeur VisualEngine direct est utilisé.
- Matrice de rotation corrigée de 72 à 36 octets ; CFrame vérifié à 48 octets. Les anciennes écritures pouvaient déborder.
- Champs RGB écrits sur 12 octets au lieu de 16 ; HP lus comme float selon le profil fourni ; copie brute de std::string distante retirée ; parcours d’enfants borné.
- Boucle d’écriture GUI inconditionnelle retirée ; ancienne adresse MouseService remplacée ; CameraOffset appliqué au Humanoid.
- Initialisation DirectX corrigée ; chargement d’image D3DX remplacé par WIC ; moteur de polices stb intégré.
- Noms de profils limités, traversées de chemin/noms réservés/liens rejetés. Aucun ancien profil chargé automatiquement au démarrage.
- Fenêtre et watermark renommés VECTOR, six onglets et 167 contrôles actifs conservés.

## Vérifications et limites

Les 21 unités de compilation et l’édition de liens Windows x64 ont réussi avec LLVM-MinGW/Clang, sans lancer l’exécutable produit. Le build utilise une liste explicite de sources. Les contrôles locaux du wrapper mémoire et des chemins de configuration ont également réussi.

La compilation MSVC sur le PC de l’utilisateur, le rendu sous Windows et le fonctionnement dans Roblox restent à vérifier. Les offsets viennent du dump fourni, sans validation réelle dans le client. Le contrôle de version compare le nom de dossier et n’authentifie pas le binaire Roblox. Les threads détachés et certains états partagés d’origine conservent des limites de cycle de vie/concurrence.

Le silent aim fourni dépend de `PlayerGui/MainScreenGui/Aim` et ne constitue pas un gestionnaire universel de raycasts. Aucune compatibilité spécifique Block Spin/Rivals n’est établie. Les fonctions masquées/incomplètes d’origine ne sont pas présentées comme opérationnelles.
