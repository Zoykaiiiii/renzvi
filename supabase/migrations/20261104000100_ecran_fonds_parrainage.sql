-- Déjà appliquée sur le projet Supabase de Renzvi.
-- La configuration de l'écran (fond choisi, widgets affichés) est une ligne comme les autres.
alter table public.widget_state drop constraint widget_state_widget_check;
alter table public.widget_state add constraint widget_state_widget_check
  check (widget in ('ecran', 'notes', 'taches', 'minuteur', 'habitudes'));

-- Photo de fond personnelle : privée, un seul fichier JPEG de 3 Mo maximum par utilisateur.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fonds', 'fonds', false, 3145728, array['image/jpeg']);

create policy "lire son fond" on storage.objects for select to authenticated
  using (bucket_id = 'fonds' and name = (select auth.uid())::text || '/fond.jpg');
create policy "creer son fond" on storage.objects for insert to authenticated
  with check (bucket_id = 'fonds' and name = (select auth.uid())::text || '/fond.jpg');
create policy "remplacer son fond" on storage.objects for update to authenticated
  using (bucket_id = 'fonds' and name = (select auth.uid())::text || '/fond.jpg')
  with check (bucket_id = 'fonds' and name = (select auth.uid())::text || '/fond.jpg');
create policy "supprimer son fond" on storage.objects for delete to authenticated
  using (bucket_id = 'fonds' and name = (select auth.uid())::text || '/fond.jpg');

-- Parrainage : aucun accès direct aux tables, tout passe par les deux fonctions ci-dessous.
create table public.referral_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_at timestamptz not null default now()
);
create table public.referrals (
  referred_id uuid primary key references auth.users (id) on delete cascade,
  referrer_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (referred_id <> referrer_id)
);
create index referrals_referrer_id on public.referrals (referrer_id);
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
revoke all on public.referral_codes, public.referrals from anon, authenticated;

create function public.get_my_referral()
returns table (referral_code text, referral_count bigint)
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'connexion requise'; end if;
  insert into public.referral_codes (user_id) values (uid) on conflict (user_id) do nothing;
  return query
    select c.code, (select count(*) from public.referrals r where r.referrer_id = uid)
    from public.referral_codes c where c.user_id = uid;
end $$;

-- Réservé aux comptes de moins de 24 h, une seule fois, jamais son propre code.
create function public.claim_referral(p_code text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); parrain uuid;
begin
  if uid is null then raise exception 'connexion requise'; end if;
  select c.user_id into parrain from public.referral_codes c where c.code = upper(p_code);
  if parrain is null or parrain = uid then return false; end if;
  if not exists (select 1 from auth.users u where u.id = uid and u.created_at > now() - interval '24 hours') then return false; end if;
  insert into public.referrals (referred_id, referrer_id) values (uid, parrain) on conflict (referred_id) do nothing;
  return found;
end $$;

revoke all on function public.get_my_referral() from public, anon;
revoke all on function public.claim_referral(text) from public, anon;
grant execute on function public.get_my_referral() to authenticated;
grant execute on function public.claim_referral(text) to authenticated;
