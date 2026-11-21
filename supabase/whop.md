# Whop Sandbox pour Renzvi

L’offre de test reprend Pro à 9,99 € TTC, par période de 30 jours, sans frais initiaux ni essai. Le prix affiché par Renzvi vient de `public.plans`. Le serveur compare la variante Whop à cette offre avant de créer le checkout. Les checkouts et les droits de test appartiennent à un projet Supabase séparé.

## Supabase et aperçu Renzvi

1. Sur le projet Supabase de test, appliquer les migrations du dépôt, dont `20261121101607_whop_sandbox.sql`. Configurer l’authentification de l’aperçu comme celle du tableau. Créer deux comptes de test avec des adresses contrôlées par l’équipe.
2. Déployer la fonction `whop` sur ce projet, en ciblant explicitement sa référence avec `supabase functions deploy whop --project-ref <ref-de-test>`. Le point d’entrée webhook est `https://<ref-de-test>.supabase.co/functions/v1/whop/webhook`. Le réglage de la fonction laisse passer ce webhook jusqu’à sa vérification de signature. Le checkout vérifie sa propre session auprès de Supabase Auth.
3. Pour le build Next de l’aperçu, configurer `RENZVI_WHOP_TEST_SUPABASE_URL` et `RENZVI_WHOP_TEST_SUPABASE_PUBLISHABLE_KEY` dans l’environnement Preview ou les exporter avant `npm run dev` dans `prototype/`. La seconde variable reçoit la clé **publique** `sb_publishable_…` du projet de test. Ces variables configurent la connexion et le tableau pour le même projet. Utiliser l’URL de l’aperçu pour les redirections Auth. Le build Vercel de production refuse ces variables.

## Compte, offre et webhook Whop

1. Dans [Whop Sandbox](https://sandbox.whop.com/dashboard/developer), créer une clé Account API du bac à sable et une variante Pro récurrente de 30 jours, 9,99 € TTC, frais initiaux de 0 €, sans essai. Pour les appels de la fonction, prévoir `company:balance:read`, `plan:basic:read`, `access_pass:basic:read`, `checkout_configuration:create` et `member:basic:read`. Le premier appel `GET /accounts/me` permet de contrôler l’identifiant `biz_…`, le statut `active` et `capabilities.accept_card_payments = active`. La fonction contrôle aussi ces valeurs avant le checkout. [Démarrage Whop](https://docs.whop.com/developer/quickstart) · [Guide Sandbox](https://docs.whop.com/developer/guides/sandbox)
2. Créer un webhook **sandbox** pour le compte, version `v1` datée `2026-11-20`. L’API accepte le corps ci-dessous pour `POST https://sandbox-api.whop.com/api/v1/webhooks`. Envoyer le bearer de gestion uniquement depuis le terminal ou le serveur et conserver la valeur `webhook_secret` dans le coffre de secrets. [Guide Webhooks](https://docs.whop.com/developer/guides/webhooks) · [Création de webhook](https://docs.whop.com/api-reference/webhooks/create-webhook)
   ```json
   {
     "resource_id": "biz_…",
     "url": "https://<ref-de-test>.supabase.co/functions/v1/whop/webhook",
     "api_version_date": "2026-11-20",
     "events": ["payment.succeeded", "membership.updated"]
   }
   ```
3. Renseigner les cinq variables de [whop.env.example](whop.env.example) dans les secrets du projet Supabase de test. `WHOP_SANDBOX_DASHBOARD_URL` reçoit l’URL complète de l’aperçu jusqu’à `/espace`, sans paramètres. Les variables Supabase utilisées par la fonction sont injectées par la plateforme. La fonction appelle les hôtes sandbox et refuse le projet et les domaines Renzvi de production.

## Vérification de bout en bout

1. Connecter A et B dans deux profils de navigateur. Les deux commencent en Gratuit. Ouvrir `/espace?whop=retour` avec B et confirmer qu’il reste Gratuit.
2. Avec A, choisir **Tester Pro avec Whop**. Payer sur `sandbox.whop.com` avec la carte de test `4242 4242 4242 4242`, une expiration future et un code à trois chiffres. Contrôler que Whop a livré `payment.succeeded`. A passe Pro et B reste Gratuit. Le retour du checkout relit l’abonnement Supabase et peut afficher une attente pendant la livraison du webhook.
3. Rejouer la livraison depuis l’historique Whop et contrôler que la ligne de A reste identique, y compris son horodatage. Désactiver le renouvellement pour la fin de période. Vérifier que A garde Pro jusqu’à la date indiquée. Terminer ensuite l’accès dans Sandbox pour déclencher un nouvel événement `membership.updated`. A repasse Gratuit. [Événement membership.updated](https://docs.whop.com/api-reference/memberships/membership-updated) · [Annulation d’un abonnement](https://docs.whop.com/api-reference/memberships/cancel-membership)

Le paiement signé porte l’identifiant du checkout lié à A côté serveur. Un événement d’abonnement reçu avant le paiement peut enregistrer l’état Whop, puis le paiement associe l’abonnement au compte. La transaction Postgres déduplique les livraisons et écarte les états plus anciens. La date de fin est aussi évaluée par `renzvi_plan()` à chaque lecture.

Le test automatisé `tests/whop.check.ts` crée deux comptes Auth sur un Supabase local et simule uniquement les réponses et notifications de Whop. Après avoir démarré et migré Supabase localement, lancer le test dans un shell avec `WHOP_TEST_SUPABASE_URL`, `WHOP_TEST_SUPABASE_PUBLISHABLE_KEY` et `WHOP_TEST_SUPABASE_SECRET_KEY` renseignées depuis le statut du Supabase **local**.

```sh
deno test --allow-env --allow-net tests/whop.check.ts
NODE_PATH=~/pw/node_modules node tests/paywall.check.cjs
```
