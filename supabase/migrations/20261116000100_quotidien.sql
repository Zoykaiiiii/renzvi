-- Quotidien (labo) : Aujourd'hui, Agenda, Liste de courses, Mes dépenses, Mes abonnements — 16 novembre 2026.
--
-- 1. widget_state accepte cinq nouvelles lignes (64 Ko au plus chacune, déjà plafonné par widget_state_taille) :
--    « aujourdhui » (ordre des sections), « agenda » (rendez-vous, 400 au plus côté app), « courses » (liste en cours et
--    listes enregistrées), « depenses » (budgets par catégorie), « abos » (abonnements suivis, 60 au plus côté app).
--    Rien n'est retiré de la liste : les 27 widgets d'avant restent autorisés, dans le même ordre.
-- 2. Table « depenses » : les dépenses grossissent sans fin (une par jour = 365 par an), elles ne tiennent pas dans
--    une ligne de 64 Ko. Montants en centimes entiers, une devise par ligne (jamais additionnées entre elles).
--    Une dépense peut venir d'un abonnement (abonnement_id = identifiant de l'abonnement dans la ligne « abos »,
--    echeance = la date de renouvellement payée) : l'index unique interdit d'enregistrer deux fois la même échéance,
--    même avec deux clics, deux onglets ou un nouvel essai après une coupure.
-- 3. Chaque compte ne voit, ne crée, ne modifie et ne supprime que ses dépenses (RLS). 20 000 dépenses au plus par compte.
-- Rien n'est supprimé ni modifié dans les données existantes.

alter table public.widget_state drop constraint widget_state_widget_check;
alter table public.widget_state add constraint widget_state_widget_check
  check (widget in ('ecran', 'notes', 'taches', 'minuteur', 'habitudes', 'vol', 'ambiance', 'compte', 'raccourcis', 'playlist', 'lecture', 'inspiration', 'cahier', 'cartes', 'revisions', 'quiz', 'schemas', 'guide',
                    'jardin', 'dessin', 'coloriage', 'puzzle', 'tangram', 'fenetre', 'ambiances', 'repas', 'dictee',
                    'aujourdhui', 'agenda', 'courses', 'depenses', 'abos'));

create table public.depenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  montant_centimes integer not null check (montant_centimes between 1 and 100000000),
  devise text not null default 'EUR' check (devise in ('EUR', 'USD', 'GBP', 'CHF', 'CAD')),
  jour date not null check (jour between date '2000-01-01' and date '2100-12-31'),
  categorie text not null check (char_length(categorie) between 1 and 40),
  libelle text not null default '' check (char_length(libelle) <= 80),
  abonnement_id uuid,
  echeance date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint depenses_lien check ((abonnement_id is null) = (echeance is null))
);
create unique index depenses_une_par_echeance on public.depenses (user_id, abonnement_id, echeance) where abonnement_id is not null;
create index depenses_par_jour on public.depenses (user_id, jour desc);

alter table public.depenses enable row level security;
create policy "lire ses depenses" on public.depenses
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "creer ses depenses" on public.depenses
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "modifier ses depenses" on public.depenses
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "supprimer ses depenses" on public.depenses
  for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.depenses from anon;

-- Même plafond que les tables Study (fonction de 20261109000700_study_quotas.sql) : compté après chaque envoi.
create trigger depenses_quota after insert on public.depenses referencing new table as nouveaux
  for each statement execute function public.study_quota('20000');
