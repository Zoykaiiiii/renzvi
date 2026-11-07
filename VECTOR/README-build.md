# Construire VECTOR

Ce projet est en **C++20 / Win32 / DirectX 11**, avec l’interface Dear ImGui. Le SDK .NET utilisé par la précédente version C# ne suffit pas pour le compiler.

## Windows : Visual Studio 2022

Installe Visual Studio 2022 ou ses Build Tools avec la charge **Développement Desktop en C++**, le compilateur **MSVC v143 x64/x86** et un SDK Windows 10/11. Le SDK DirectX de juin 2010 n’est plus requis par le projet nettoyé : les images en mémoire passent par Windows Imaging Component (WIC).

Ferme une éventuelle instance de VECTOR, puis lance `Build.cmd`. Le script utilise le MSBuild présent dans le terminal ou celui trouvé par `vswhere` dans l’installation Visual Studio. Il n’installe rien, ne télécharge aucun code et ne lance pas l’exécutable produit.

Autre possibilité : ouvre `VECTOR.sln`, choisis **Release / x64**, puis **Générer la solution**. La sortie prévue est `dist/Release/VECTOR.exe`. La configuration Debug utilise `dist/Debug`.

## CMake

Avec CMake 3.21 ou plus récent et les mêmes composants Visual Studio :

```powershell
cmake -S . -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release
```

La sortie reste `dist/Release/VECTOR.exe`.

Pour une chaîne Windows croisée déjà installée (par exemple LLVM-MinGW), fournis un fichier de toolchain CMake qui définit Windows et les compilateurs x64 :

```sh
cmake -S . -B build-cross -DCMAKE_TOOLCHAIN_FILE=/chemin/windows-x64.cmake -DCMAKE_BUILD_TYPE=Release
cmake --build build-cross
```

Le projet rejette une cible native Linux ou 32 bits. La prise en charge de cette voie dépend des en-têtes et de la bibliothèque C++20 de la chaîne utilisée. Aucun outil provenant de l’archive originale n’est nécessaire à la compilation.

## Dépendances et provenance

Les listes de sources sont explicites dans `VECTOR.vcxproj` et `CMakeLists.txt`. Elles incluent les fonctionnalités du programme, le cache, l’interface, la configuration locale, Dear ImGui avec ses backends Win32/DX11 et Clipper2. Les bibliothèques liées sont uniquement les bibliothèques d’importation système du SDK Windows.

Les archives et DLL précompilées fournies dans l’archive d’origine ne font pas partie de ce build. Aucun lien vers Lua, FreeType précompilé, GLFW ou uSynergy n’est présent. Le rendu des polices utilise le backend `stb_truetype` intégré à ImGui ; il peut différer légèrement du rendu FreeType initial.

Le module Lua présent dans les fichiers initiaux n’était pas compilé ni initialisé dans l’application d’origine. L’ajouter ultérieurement exige une dépendance reconstruite depuis une source officielle et une conception explicite des bibliothèques accessibles aux scripts. Aucun Lua opaque n’est réintroduit ici.

Le projet ne contient pas d’étape de téléchargement, de commande préalable/postérieure personnalisée, de module d’authentification distant ou de binaire embarqué à exécuter. Les copyrights et licences des composants tiers restent applicables ; le nom VECTOR n’en transfère pas la propriété.

## Limites de validation

Les **21 unités C++ ont été compilées et liées avec succès pour Windows x64**, sous Linux avec LLVM-MinGW / Clang 23.1.5. Cette vérification utilisait uniquement les sources nettoyées et les bibliothèques système, avec `IMGUI_IMPL_WIN32_DISABLE_GAMEPAD` pour exclure le chargement XInput inutile. Le manifeste des dépendances de compilation identifie les 76 fichiers source et en-tête effectivement utilisés.

L’exécutable produit n’a pas été lancé. La compilation MSVC, le script `Build.cmd`, l’affichage sous Windows et le fonctionnement en jeu restent à vérifier dans leur environnement Windows. Une compilation ne prouve pas l’exactitude des offsets ou l’absence de tout défaut ; le rapport d’analyse précise les contrôles statiques réalisés.
