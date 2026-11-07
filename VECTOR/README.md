# VECTOR

Reconstruction en C++ de l’interface et des fonctionnalités actives de l’archive `1777127053283-night.zip`. Ce projet est distinct de l’ancienne application VECTOR en C# : utilise un nouveau dossier.

## Compilation et utilisation

1. Installe Visual Studio 2022 ou Build Tools avec **Développement Desktop en C++**, MSVC v143 et un SDK Windows 10/11.
2. Lance `Build.cmd`, ou ouvre `VECTOR.sln` et génère **Release / x64**.
3. La sortie est `dist\Release\VECTOR.exe`. Le script de compilation ne lance pas ce programme.
4. Le programme attend le processus Roblox et un jeu chargé. **Insert** ou **Maj droite** affiche/masque le menu.

Le profil intégré correspond uniquement à `version-f0ea5da9412f4e35`, à partir du dump fourni daté du 4 novembre 2026. Une autre version est rejetée au démarrage. Le dossier de version est un contrôle de compatibilité, pas une validation des valeurs en mémoire.

## Interface conservée

Les six onglets d’origine et leurs 167 contrôles sont conservés : legit, visuals, exploits, world, miscellaneous et configuration. Ils comprennent la visée rotation/souris, les hotkeys, le lissage et la prédiction, ESP/squelette/noms/HP, les réglages de déplacement, l’éclairage, les joueurs et les profils locaux. Le nom de fenêtre et le watermark sont VECTOR. Les profils sont dans `%APPDATA%\vector_config\configs`.

Le rendu des polices utilise stb_truetype plutôt que la bibliothèque FreeType précompilée reçue ; de petites différences de rasterisation sont possibles. Les images embarquées sont décodées avec WIC de Windows.

## Périmètre réel

Les fonctions Lua et l’UI desync étaient désactivées dans les sources reçues. Elles ne sont pas réactivées ; l’ancien code desync sans offset compatible est retiré. Aucune adresse inconnue n’est inventée. Le silent aim existant dépend d’une arborescence GUI spécifique ; sa présence dans le menu ne démontre pas une compatibilité Block Spin ou Rivals. L’archive ne possédait pas de panneau ESP preview dédié.

Lis `ANALYSE.md` pour les suppressions et les limites de vérification, et `README-build.md` pour les détails de compilation.
