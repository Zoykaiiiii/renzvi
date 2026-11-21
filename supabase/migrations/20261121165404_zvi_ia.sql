-- Zvi est inclus dans Worker et partage les limites horaires et le budget IA du Cahier.
alter table public.ia_prix
  drop constraint ia_prix_type_check,
  drop constraint ia_prix_credits_min_check,
  add constraint ia_prix_type_check check (type in ('cartes', 'resume', 'expliquer', 'quiz', 'zvi')),
  add constraint ia_prix_credits_min_check check (case when type = 'zvi' then credits_min = 0 else credits_min >= 1 end);

insert into public.ia_prix
  (type, caracteres_par_credit, credits_min, credits_max, caracteres_max, centimes_par_credit)
  values ('zvi', 4000, 0, 0, 4000, 0.5);


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
  -- Même validité que renzvi_plan(), pour le compte authentifié par l'Edge Function.
  if p_type = 'zvi' and not exists (
    select from public.abonnements a
    where a.user_id = p_user and a.plan = 'worker' and a.statut in ('actif', 'essai', 'annule')
      and (a.fin is null or a.fin > now())
  ) then
    return jsonb_build_object('ok', false, 'raison', 'plan_worker');
  end if;
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
  if p_type <> 'zvi' and not w.decouverte_donnee and r.credits_decouverte > 0 and exists (select 1 from auth.users u where u.id = p_user and u.email_confirmed_at is not null)
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
  estimation := case when p_type = 'zvi' then 1 else cout * prix.centimes_par_credit end;
  perform pg_advisory_xact_lock(hashtext('ia_budget_jour'));
  select coalesce(sum(case when etat = 'en_cours' then greatest(estimation_centimes, depense_centimes) else depense_centimes end), 0) into depense_jour
    from public.ia_travaux where created_at >= date_trunc('day', now());
  if depense_jour + estimation > r.budget_jour_centimes then return jsonb_build_object('ok', false, 'raison', 'budget_global'); end if;

  insert into public.ia_travaux (id, user_id, type, cle, etat, caracteres, credits, estimation_centimes)
    values (p_travail, p_user, p_type, left(p_cle, 200), 'en_cours', p_caracteres, cout, estimation);
  if cout > 0 then
    update public.ia_portefeuilles set solde = solde - cout where user_id = p_user returning * into w;
    insert into public.ia_journal (user_id, travail, variation, motif, solde_apres) values (p_user, p_travail, -cout, 'reservation', w.solde);
  end if;
  return jsonb_build_object('ok', true, 'travail', p_travail, 'credits', cout, 'solde', w.solde, 'estimation_centimes', estimation);
end $$;
