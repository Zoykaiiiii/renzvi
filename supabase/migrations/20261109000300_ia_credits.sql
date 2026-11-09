-- Study S4 : crédits et garde-fous de l'IA. Aucun fournisseur payant n'est branché : la fonction serveur « ia » utilise
-- un fournisseur simulé tant que la configuration ne dit pas le contraire.
--
-- Principe : le navigateur ne fixe jamais ni son solde, ni le prix, ni la personne débitée. Il appelle la fonction
-- serveur « ia » avec sa session ; celle-ci vérifie la session, calcule le prix avec la grille ci-dessous et appelle
-- ia_reserver puis ia_terminer. Ces deux fonctions ne sont pas appelables depuis le navigateur.
-- Le navigateur peut seulement lire son solde, son journal et ses travaux.

-- Les offres (hypothèses à calibrer, aucun paiement branché) : crédits par mois.
create table public.ia_offres (
  id text primary key check (id ~ '^[a-z_]{1,20}$'),
  nom text not null,
  credits_par_mois integer not null check (credits_par_mois >= 0)
);
insert into public.ia_offres (id, nom, credits_par_mois) values
  ('gratuit', 'Gratuit', 0), ('pro', 'Pro', 200), ('pro_ia', 'Pro IA', 1000);

-- La grille de prix, en crédits, par type de travail. Le coût = ceil(caractères / caracteres_par_credit), borné.
-- centimes_par_credit estime la dépense fournisseur pour le budget global ; à remplacer par des coûts mesurés.
create table public.ia_prix (
  type text primary key check (type in ('cartes', 'resume', 'expliquer', 'quiz')),
  caracteres_par_credit integer not null check (caracteres_par_credit > 0),
  credits_min integer not null check (credits_min >= 1),
  credits_max integer not null check (credits_max >= credits_min),
  caracteres_max integer not null check (caracteres_max between 1 and 200000),
  centimes_par_credit numeric(8, 3) not null check (centimes_par_credit >= 0)
);
insert into public.ia_prix values
  ('cartes', 4000, 1, 10, 40000, 0.5), ('resume', 4000, 1, 10, 40000, 0.5),
  ('quiz', 4000, 1, 10, 40000, 0.5), ('expliquer', 2000, 1, 1, 2000, 0.5);

-- Réglages globaux : une seule ligne.
create table public.ia_reglages (
  id boolean primary key default true check (id),
  budget_jour_centimes integer not null check (budget_jour_centimes >= 0),
  credits_decouverte integer not null check (credits_decouverte >= 0),
  travaux_simultanes integer not null check (travaux_simultanes >= 1),
  travaux_par_heure integer not null check (travaux_par_heure >= 1),
  -- Un travail resté « en_cours » plus longtemps est considéré comme interrompu : crédits rendus.
  duree_max_secondes integer not null check (duree_max_secondes between 10 and 900),
  active boolean not null default true
);
insert into public.ia_reglages values (true, 500, 30, 2, 20, 120, true);

create table public.ia_portefeuilles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  offre text not null default 'gratuit' references public.ia_offres (id),
  solde integer not null default 0 check (solde >= 0),
  decouverte_donnee boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.ia_travaux (
  -- Identifiant choisi par le navigateur : renvoyer la même demande ne débite pas deux fois.
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null references public.ia_prix (type),
  -- Ce que le travail concerne (cours, chapitre, version) : retrouver un résultat déjà payé au lieu de le refaire.
  cle text check (char_length(cle) <= 200),
  etat text not null check (etat in ('en_cours', 'reussi', 'echoue', 'annule')),
  caracteres integer not null check (caracteres >= 0),
  credits integer not null check (credits >= 0),
  estimation_centimes numeric(10, 3) not null default 0,
  -- Dépense fournisseur réelle, comptée même quand le travail échoue.
  depense_centimes numeric(10, 3) not null default 0,
  tentatives integer not null default 0 check (tentatives between 0 and 5),
  erreur text check (char_length(erreur) <= 300),
  resultat jsonb check (resultat is null or pg_column_size(resultat) <= 65536),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index ia_travaux_user on public.ia_travaux (user_id, created_at);
create index ia_travaux_jour on public.ia_travaux (created_at);
create index ia_travaux_cle on public.ia_travaux (user_id, cle, created_at) where cle is not null;

create table public.ia_journal (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  travail uuid references public.ia_travaux (id) on delete set null,
  variation integer not null,
  motif text not null check (motif in ('decouverte', 'offre', 'reservation', 'remboursement', 'ajustement')),
  solde_apres integer not null,
  created_at timestamptz not null default now()
);
create index ia_journal_user on public.ia_journal (user_id, created_at);

-- Lecture seule pour la personne, rien pour les visiteurs. Toutes les écritures passent par les fonctions serveur.
alter table public.ia_offres enable row level security;
alter table public.ia_prix enable row level security;
alter table public.ia_reglages enable row level security;
alter table public.ia_portefeuilles enable row level security;
alter table public.ia_travaux enable row level security;
alter table public.ia_journal enable row level security;
create policy "lire les offres" on public.ia_offres for select to authenticated using (true);
create policy "lire les prix" on public.ia_prix for select to authenticated using (true);
create policy "lire son portefeuille" on public.ia_portefeuilles for select to authenticated using ((select auth.uid()) = user_id);
create policy "lire ses travaux" on public.ia_travaux for select to authenticated using ((select auth.uid()) = user_id);
create policy "lire son journal" on public.ia_journal for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.ia_offres, public.ia_prix, public.ia_reglages, public.ia_portefeuilles, public.ia_travaux, public.ia_journal from anon;
revoke insert, update, delete, truncate on public.ia_offres, public.ia_prix, public.ia_reglages, public.ia_portefeuilles, public.ia_travaux, public.ia_journal from authenticated;

-- Le prix d'un travail selon la grille.
create function public.ia_cout(p_type text, p_caracteres integer) returns integer language sql stable set search_path = '' as $$
  select least(p.credits_max, greatest(p.credits_min, ceil(p_caracteres::numeric / p.caracteres_par_credit)::integer))
  from public.ia_prix p where p.type = p_type
$$;

-- Réserve les crédits d'un travail, après toutes les vérifications. Renvoie l'état du travail :
--   { ok: true, travail, credits, solde }         travail créé (ou déjà réussi : resultat renvoyé, rien débité)
--   { ok: false, raison }                          refusé, rien débité
create function public.ia_reserver(p_user uuid, p_travail uuid, p_type text, p_caracteres integer, p_cle text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.ia_reglages;
  prix public.ia_prix;
  w public.ia_portefeuilles;
  t public.ia_travaux;
  cout integer;
  estimation numeric;
  depense_jour numeric;
begin
  select * into r from public.ia_reglages;
  select * into prix from public.ia_prix where type = p_type;
  if prix.type is null then return jsonb_build_object('ok', false, 'raison', 'type_inconnu'); end if;

  -- Le portefeuille est verrouillé : deux demandes simultanées de la même personne passent l'une après l'autre.
  insert into public.ia_portefeuilles (user_id) values (p_user) on conflict (user_id) do nothing;
  select * into w from public.ia_portefeuilles where user_id = p_user for update;

  -- Même identifiant : on renvoie le travail existant, sans nouveau débit.
  select * into t from public.ia_travaux where id = p_travail;
  if t.id is not null then
    if t.user_id <> p_user then return jsonb_build_object('ok', false, 'raison', 'identifiant_pris'); end if;
    return jsonb_build_object('ok', t.etat = 'reussi', 'deja', true, 'travail', t.id, 'etat', t.etat, 'resultat', t.resultat, 'credits', t.credits, 'solde', w.solde,
      'raison', case t.etat when 'en_cours' then 'deja_en_cours' when 'reussi' then null else 'deja_termine' end);
  end if;

  if not r.active then return jsonb_build_object('ok', false, 'raison', 'ia_desactivee'); end if;
  if p_caracteres < 1 or p_caracteres > prix.caracteres_max then return jsonb_build_object('ok', false, 'raison', 'texte_trop_long', 'max', prix.caracteres_max); end if;

  -- Crédits de découverte, une seule fois et seulement avec un email vérifié.
  if not w.decouverte_donnee and r.credits_decouverte > 0 and exists (select 1 from auth.users u where u.id = p_user and u.email_confirmed_at is not null) then
    update public.ia_portefeuilles set solde = solde + r.credits_decouverte, decouverte_donnee = true where user_id = p_user returning * into w;
    insert into public.ia_journal (user_id, variation, motif, solde_apres) values (p_user, r.credits_decouverte, 'decouverte', w.solde);
  end if;

  -- Travaux interrompus (fonction arrêtée en plein travail) : crédits rendus, la dépense éventuelle reste comptée.
  perform public.ia_terminer(x.id, 'echoue', null, 0, 'interrompu')
    from public.ia_travaux x where x.user_id = p_user and x.etat = 'en_cours' and x.created_at < now() - make_interval(secs => r.duree_max_secondes);

  if (select count(*) from public.ia_travaux where user_id = p_user and etat = 'en_cours') >= r.travaux_simultanes then
    return jsonb_build_object('ok', false, 'raison', 'trop_de_travaux');
  end if;
  if (select count(*) from public.ia_travaux where user_id = p_user and created_at > now() - interval '1 hour') >= r.travaux_par_heure then
    return jsonb_build_object('ok', false, 'raison', 'trop_de_demandes');
  end if;

  cout := public.ia_cout(p_type, p_caracteres);
  select * into w from public.ia_portefeuilles where user_id = p_user;
  if w.solde < cout then return jsonb_build_object('ok', false, 'raison', 'solde_insuffisant', 'credits', cout, 'solde', w.solde); end if;

  -- Budget global du jour : dépenses réelles + estimations des travaux en cours + ce travail.
  estimation := cout * prix.centimes_par_credit;
  perform pg_advisory_xact_lock(hashtext('ia_budget_jour'));
  select coalesce(sum(case when etat = 'en_cours' then greatest(estimation_centimes, depense_centimes) else depense_centimes end), 0) into depense_jour
    from public.ia_travaux where created_at >= date_trunc('day', now());
  if depense_jour + estimation > r.budget_jour_centimes then return jsonb_build_object('ok', false, 'raison', 'budget_global'); end if;

  insert into public.ia_travaux (id, user_id, type, cle, etat, caracteres, credits, estimation_centimes)
    values (p_travail, p_user, p_type, left(p_cle, 200), 'en_cours', p_caracteres, cout, estimation);
  update public.ia_portefeuilles set solde = solde - cout where user_id = p_user returning * into w;
  insert into public.ia_journal (user_id, travail, variation, motif, solde_apres) values (p_user, p_travail, -cout, 'reservation', w.solde);
  return jsonb_build_object('ok', true, 'travail', p_travail, 'credits', cout, 'solde', w.solde);
end $$;

-- Termine un travail une seule fois. Réussi : les crédits réservés sont dus. Échoué ou annulé : ils sont rendus.
-- La dépense fournisseur est ajoutée dans tous les cas.
create function public.ia_terminer(p_travail uuid, p_etat text, p_resultat jsonb, p_depense numeric, p_erreur text default null, p_tentatives integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t public.ia_travaux;
  w public.ia_portefeuilles;
begin
  if p_etat not in ('reussi', 'echoue', 'annule') then raise exception 'etat invalide'; end if;
  -- Même ordre de verrouillage que ia_reserver (portefeuille, puis travail) : pas d'interblocage.
  select * into t from public.ia_travaux where id = p_travail;
  if t.id is null then return jsonb_build_object('ok', false, 'raison', 'inconnu'); end if;
  perform 1 from public.ia_portefeuilles where user_id = t.user_id for update;
  select * into t from public.ia_travaux where id = p_travail for update;
  if t.etat <> 'en_cours' then return jsonb_build_object('ok', false, 'raison', 'deja_termine', 'etat', t.etat); end if;
  update public.ia_travaux set etat = p_etat, resultat = case when p_etat = 'reussi' then p_resultat end,
    depense_centimes = depense_centimes + greatest(coalesce(p_depense, 0), 0), erreur = left(p_erreur, 300),
    tentatives = coalesce(p_tentatives, tentatives), finished_at = now()
    where id = p_travail;
  if p_etat <> 'reussi' and t.credits > 0 then
    update public.ia_portefeuilles set solde = solde + t.credits where user_id = t.user_id returning * into w;
    insert into public.ia_journal (user_id, travail, variation, motif, solde_apres) values (t.user_id, t.id, t.credits, 'remboursement', w.solde);
  end if;
  return jsonb_build_object('ok', true, 'etat', p_etat);
end $$;

-- Les fonctions d'écriture ne sont ouvertes qu'au serveur (rôle service), jamais au navigateur.
revoke all on function public.ia_reserver, public.ia_terminer from public, anon, authenticated;
grant execute on function public.ia_reserver, public.ia_terminer to service_role;
grant execute on function public.ia_cout to authenticated;
