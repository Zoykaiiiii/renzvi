-- Correctifs de l'audit du 9 novembre 2026.
--
-- 1. Les règles de création comptaient les lignes de leur propre table : Postgres refusait toute création
--    (« infinite recursion detected in policy »). Et un envoi groupé passait au-dessus de la limite, compté une
--    seule fois avant l'envoi. Les limites passent dans un déclencheur exécuté après chaque envoi : il voit toutes
--    les lignes envoyées et fait passer l'une après l'autre les créations simultanées d'une même personne.
create or replace function public.study_quota() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  lim integer := tg_argv[0]::integer;
  u uuid;
  n bigint;
begin
  for u in select distinct user_id from nouveaux order by 1 loop
    perform pg_advisory_xact_lock(hashtext(tg_table_name), hashtext(u::text));
    execute format('select count(*) from public.%I where user_id = $1', tg_table_name) into n using u;
    if n > lim then raise exception 'limite atteinte : % au plus', lim using errcode = 'P0001'; end if;
  end loop;
  return null;
end $$;
revoke all on function public.study_quota() from public, anon, authenticated;

create trigger study_courses_quota after insert on public.study_courses referencing new table as nouveaux
  for each statement execute function public.study_quota('30');
create trigger study_cards_quota after insert on public.study_cards referencing new table as nouveaux
  for each statement execute function public.study_quota('3000');
create trigger study_questions_quota after insert on public.study_questions referencing new table as nouveaux
  for each statement execute function public.study_quota('3000');
create trigger study_schemas_quota after insert on public.study_schemas referencing new table as nouveaux
  for each statement execute function public.study_quota('200');

drop policy "creer ses cours" on public.study_courses;
create policy "creer ses cours" on public.study_courses
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy "creer ses cartes" on public.study_cards;
create policy "creer ses cartes" on public.study_cards
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (course_id is null or exists (select 1 from public.study_courses c where c.id = course_id and c.user_id = (select auth.uid())))
  );

drop policy "creer ses questions" on public.study_questions;
create policy "creer ses questions" on public.study_questions for insert to authenticated with check (
  (select auth.uid()) = user_id
  and (course_id is null or exists (select 1 from public.study_courses c where c.id = course_id and c.user_id = (select auth.uid())))
);

drop policy "creer ses schemas" on public.study_schemas;
create policy "creer ses schemas" on public.study_schemas for insert to authenticated with check (
  (select auth.uid()) = user_id
  and (course_id is null or exists (select 1 from public.study_courses c where c.id = course_id and c.user_id = (select auth.uid())))
);

-- 2. Fichiers : le nom seul était vérifié, donc fichiers sans cours en nombre illimité. Plafond par personne :
--    2 fichiers par cours (30 cours) et 1 image par schéma (200), plus une marge pour un nettoyage raté.
--    L'appli envoie les fichiers avant de créer la ligne : on compte les fichiers, pas les lignes.
--    Fonction plpgsql (jamais intégrée à la règle, donc pas de boucle) ; elle ne voit que les fichiers de la personne.
create or replace function public.study_files_ok(p_bucket text, p_max integer) returns boolean
language plpgsql volatile set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('fichiers_' || p_bucket), hashtext((select auth.uid())::text));
  return (select count(*) from storage.objects o where o.bucket_id = p_bucket and o.name like (select auth.uid())::text || '/%') < p_max;
end $$;
revoke all on function public.study_files_ok(text, integer) from public, anon;
grant execute on function public.study_files_ok(text, integer) to authenticated;

drop policy "creer ses cours (fichiers)" on storage.objects;
create policy "creer ses cours (fichiers)" on storage.objects for insert to authenticated
  with check (bucket_id = 'cours' and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}/(original\.(pdf|txt)|texte\.json)$')
    and public.study_files_ok('cours', 64));
drop policy "creer ses images de schemas" on storage.objects;
create policy "creer ses images de schemas" on storage.objects for insert to authenticated
  with check (bucket_id = 'schemas' and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}\.jpg$')
    and public.study_files_ok('schemas', 205));

-- 3. IA : 30 crédits offerts par compte vérifié ; une série de faux comptes pouvait épuiser le budget du jour pour
--    tout le monde. Au plus 50 comptes servis par jour (réglable dans ia_reglages).
alter table public.ia_reglages add column decouvertes_par_jour integer not null default 50 check (decouvertes_par_jour >= 0);

create or replace function public.ia_reserver(p_user uuid, p_travail uuid, p_type text, p_caracteres integer, p_cle text default null)
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

  -- Crédits de découverte, une seule fois et seulement avec un email vérifié. Nombre de comptes servis par jour plafonné :
  -- au-delà, la personne les reçoit un autre jour (protège le budget global contre une série de faux comptes).
  if not w.decouverte_donnee and r.credits_decouverte > 0 and exists (select 1 from auth.users u where u.id = p_user and u.email_confirmed_at is not null)
    and (select count(*) from public.ia_journal j where j.motif = 'decouverte' and j.created_at >= date_trunc('day', now())) < r.decouvertes_par_jour then
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
