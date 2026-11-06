# CLAUDE.md — Renzvi

**Prochain Claude : lis `memoire.md` en entier avant de commencer.** Il contient l'état du projet, les décisions, les prochaines étapes et les plugins à installer.

## 1. Comment bosser avec moi
- Damien, fondateur **non technique** : je pilote tout en langage naturel. Je ne code pas.
- Réponds en **français simple**. Pour un choix technique : la conséquence concrète (coût, délai, risque), pas un cours.
- **Premiers euros vite** : priorise ce qui rapproche d'un produit vendable.
- **Sois critique et franc.** Si une idée est mauvaise pour le business, dis-le. Jamais de « c'est bien » par politesse.
- **Propose et critique avant de construire**, on tranche, ensuite on code. Avant une techno : 2 options max avec coût, délai et ta reco.
- **Teste avant de dire que c'est fini** (lancer, capture) et dis honnêtement ce qui ne marche pas.
- **Aucun secret dans le code ou le chat.** Variables d'environnement (`.env`, jamais commité) : dis-moi quel nom remplir et où.
- **Pas de dépense cachée.** Avant toute API payante : coût par utilisateur. Chaque appel payant est compté et plafonné par utilisateur.
- Commits petits, messages clairs en français.
- **Pas de PR ni de fusion à faire pour Damien** : quand il dit « commit push », pousser directement sur `main` avec exactement `git push origin main`. Tester avant, ne jamais pousser sans sa demande. À revoir dès qu'il y a des clients payants.

## 2. Le produit
**Renzvi : chaque utilisateur a son dashboard personnel composé de widgets.** (À préciser : quels widgets, pour qui, ce qui est payant.)

- Stack prévue : Next.js + Supabase (compte Pro existant). Paiement : Whop.

## 3. Design
- **Tout écran passe par le skill `design-taste-frontend`** (`.claude/skills/`).
- Je déteste le look « vibecodé par IA » ou enfantin : propre, sobre, moderne.
- Référence d'ambiance : liquidjournal.app (inspiration, **jamais copie**).
- **Décision (2 nov. 2026) : dashboard en glassmorphism clair pour démarrer** (fond blanc/gris clair, panneaux givrés, image de fond floue, choisissable). Le style changera ensuite → tout passe par des variables CSS. Cette décision prime sur l'interdiction du glass dans le skill, pour le dashboard. Landing : à trancher.

## 4. Légal et business
- Pas de fausses stats, faux avis, faux compteurs, faux prix barrés (loi française). Prix affichés **TTC**.
- RGPD : données privées par défaut, collecter le minimum.
- Whop : régler les prix **TVA incluse** (sinon TVA ajoutée au checkout).
- Navigateurs intégrés TikTok/Instagram : pas de connexion Google → connexion par code email + message « ouvrir dans Safari ».
