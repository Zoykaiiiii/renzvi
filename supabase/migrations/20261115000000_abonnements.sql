-- Abonnements, étape 1 : les plans et l'abonnement de chaque compte. AUCUN paiement ici.
-- Rien d'existant n'est modifié ni supprimé.
--
-- plans : le catalogue (Gratuit, Pro, Worker). Prix en centimes, TTC (TVA incluse), mensuels : c'est le prix payé.
--   Lisible par tous les comptes connectés ; modifiable seulement depuis le tableau de bord Supabase.
--   whop_plan_id : vide tant que Whop n'est pas branché ; on y mettra l'identifiant du plan Whop correspondant.
-- abonnements : une ligne par compte qui a (ou a eu) un plan payant. Pas de ligne = Gratuit.
--   Le navigateur LIT sa propre ligne, il ne peut NI la créer, NI la modifier, NI la supprimer : seul le serveur
--   (plus tard, le webhook Whop avec la clé de service) l'écrit. Sinon n'importe qui se donnerait le Pro.
-- renzvi_plan() : le plan en vigueur pour le compte connecté ('gratuit', 'pro' ou 'worker'), échéance comprise.
--
-- Les fonctions de chaque plan ne sont PAS décidées : rien dans l'app n'est verrouillé par cette migration.

create table public.plans (
  id text primary key check (id ~ '^[a-z]{2,20}$'),
  nom text not null check (char_length(nom) between 1 and 40),
  prix_mensuel_ttc_centimes integer not null check (prix_mensuel_ttc_centimes >= 0),
  rang smallint not null unique, -- 0 = gratuit ; plus grand = plus complet
  whop_plan_id text unique
);
alter table public.plans enable row level security;
create policy "lire les plans" on public.plans for select to authenticated using (true);
revoke insert, update, delete on public.plans from anon, authenticated;
revoke all on public.plans from anon;

insert into public.plans (id, nom, prix_mensuel_ttc_centimes, rang) values
  ('gratuit', 'Gratuit', 0, 0),
  ('pro', 'Pro', 999, 1),
  ('worker', 'Worker', 1799, 2);

create table public.abonnements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null references public.plans (id),
  -- actif : payé ; essai : période d'essai ; annule : résilié mais payé jusqu'à « fin » ; expire : terminé.
  statut text not null check (statut in ('actif', 'essai', 'annule', 'expire')),
  fin timestamptz, -- fin de la période payée (ou de l'essai) ; vide = sans fin connue
  source text not null default 'manuel' check (source in ('manuel', 'whop')),
  whop_membership_id text unique,
  updated_at timestamptz not null default now()
);
alter table public.abonnements enable row level security;
create policy "lire son abonnement" on public.abonnements
  for select to authenticated using ((select auth.uid()) = user_id);
-- Aucune règle d'écriture pour les comptes : seul le rôle de service (qui ignore les règles) écrit.
revoke insert, update, delete on public.abonnements from anon, authenticated;
revoke all on public.abonnements from anon;

-- Le plan en vigueur. Un abonnement résilié reste valable jusqu'à sa fin ; expiré ou échu, c'est Gratuit.
create function public.renzvi_plan() returns text
  language sql stable security invoker set search_path = ''
as $$
  select coalesce((
    select a.plan from public.abonnements a
    where a.user_id = (select auth.uid())
      and a.statut in ('actif', 'essai', 'annule')
      and (a.fin is null or a.fin > now())
  ), 'gratuit')
$$;
revoke execute on function public.renzvi_plan() from anon;
