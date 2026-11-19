-- Plafonds du Cahier par abonnement. Les cours déjà créés restent modifiables après un changement de plan.
create schema if not exists renzvi_internal;
grant usage on schema renzvi_internal to authenticated, service_role;

create function renzvi_internal.plan_for(p_user uuid) returns text
language sql stable security invoker set search_path = '' as $$
  select coalesce((
    select a.plan from public.abonnements a
    where a.user_id = p_user
      and a.statut in ('actif', 'essai', 'annule')
      and (a.fin is null or a.fin > now())
  ), 'gratuit')
$$;
revoke all on function renzvi_internal.plan_for(uuid) from public, anon;
grant execute on function renzvi_internal.plan_for(uuid) to authenticated, service_role;

create or replace function public.renzvi_plan() returns text
language sql stable security invoker set search_path = '' as $$
  select renzvi_internal.plan_for((select auth.uid()))
$$;

create function renzvi_internal.study_course_quota() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  u uuid;
  lim integer;
begin
  for u in select distinct user_id from nouveaux order by 1 loop
    lim := case renzvi_internal.plan_for(u) when 'worker' then null when 'pro' then 10 else 1 end;
    if lim is null then continue; end if;
    perform pg_advisory_xact_lock(hashtext('study_courses'), hashtext(u::text));
    if exists (select 1 from public.study_courses c where c.user_id = u offset lim) then
      raise exception 'study_course_quota' using errcode = 'P0001', detail = lim::text;
    end if;
  end loop;
  return null;
end $$;
revoke all on function renzvi_internal.study_course_quota() from public, anon, authenticated, service_role;

drop trigger study_courses_quota on public.study_courses;
create trigger study_courses_quota after insert on public.study_courses referencing new table as nouveaux
  for each statement execute function renzvi_internal.study_course_quota();

-- Les fichiers précèdent la création du cours. Seuls les fichiers sans cours comptent dans la marge de 64.
create function renzvi_internal.study_course_files_ok(p_name text) returns boolean
language plpgsql volatile security invoker set search_path = '' as $$
declare
  u uuid := (select auth.uid());
begin
  perform pg_advisory_xact_lock(hashtext('fichiers_cours'), hashtext(u::text));
  return exists (
    select 1 from public.study_courses c
    where c.user_id = u and c.id::text = split_part(p_name, '/', 2)
  ) or not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'cours' and o.name like u::text || '/%' and o.name <> p_name
      and not exists (
        select 1 from public.study_courses c
        where c.user_id = u and c.id::text = split_part(o.name, '/', 2)
      )
    offset 63
  );
end $$;
revoke all on function renzvi_internal.study_course_files_ok(text) from public, anon;
grant execute on function renzvi_internal.study_course_files_ok(text) to authenticated;

alter policy "creer ses cours (fichiers)" on storage.objects
  with check (
    bucket_id = 'cours' and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}/(original\.(pdf|txt)|texte\.json)$')
    and renzvi_internal.study_course_files_ok(name)
  );
alter policy "remplacer ses cours (fichiers)" on storage.objects
  with check (
    bucket_id = 'cours' and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}/(original\.(pdf|txt)|texte\.json)$')
    and renzvi_internal.study_course_files_ok(name)
  );
