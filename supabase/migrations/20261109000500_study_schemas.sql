-- Study S7 : les schémas masqués. Une image (photo, capture ou page du cours) gardée dans le stockage privé « schemas »,
-- et les zones de ses légendes encadrées une fois par la personne, en coordonnées de 0 à 1 (elles suivent le
-- redimensionnement). « Interroge-moi » cache au hasard une ou plusieurs zones ; chaque réponse est gardée.
-- Aucune IA, aucune détection automatique.

alter table public.widget_state drop constraint widget_state_widget_check;
alter table public.widget_state add constraint widget_state_widget_check
  check (widget in ('ecran', 'notes', 'taches', 'minuteur', 'habitudes', 'vol', 'ambiance', 'compte', 'raccourcis', 'playlist', 'lecture', 'inspiration', 'cahier', 'cartes', 'revisions', 'quiz', 'schemas'));

create table public.study_schemas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  deck text not null check (char_length(deck) between 1 and 60),
  titre text not null check (char_length(titre) between 1 and 120),
  course_id uuid references public.study_courses (id) on delete set null,
  src_page integer check (src_page between 0 and 199),
  largeur integer not null check (largeur between 1 and 4000),
  hauteur integer not null check (hauteur between 1 and 4000),
  -- [{ id, x, y, w, h, reponse }] : x, y, w, h entre 0 et 1.
  zones jsonb not null default '[]' check (jsonb_typeof(zones) = 'array' and jsonb_array_length(zones) <= 40 and pg_column_size(zones) <= 16384),
  -- Passe à vrai quand l'image est remplacée : les zones doivent être revérifiées avant de s'interroger.
  zones_a_verifier boolean not null default false,
  image_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index study_schemas_user on public.study_schemas (user_id, created_at);

alter table public.study_schemas enable row level security;
create policy "lire ses schemas" on public.study_schemas for select to authenticated using ((select auth.uid()) = user_id);
-- 200 schémas au plus par personne.
create policy "creer ses schemas" on public.study_schemas for insert to authenticated with check (
  (select auth.uid()) = user_id
  and (course_id is null or exists (select 1 from public.study_courses c where c.id = course_id and c.user_id = (select auth.uid())))
  and (select count(*) from public.study_schemas s where s.user_id = (select auth.uid())) < 200
);
create policy "modifier ses schemas" on public.study_schemas for update to authenticated using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and (course_id is null or exists (select 1 from public.study_courses c where c.id = course_id and c.user_id = (select auth.uid())))
);
create policy "supprimer ses schemas" on public.study_schemas for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.study_schemas from anon;

create table public.study_schema_answers (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  schema_id uuid not null references public.study_schemas (id) on delete cascade,
  zone_id text not null check (char_length(zone_id) between 1 and 40),
  reussie boolean not null,
  created_at timestamptz not null default now()
);
create index study_schema_answers_schema on public.study_schema_answers (schema_id, created_at);
alter table public.study_schema_answers enable row level security;
create policy "lire ses reponses de schemas" on public.study_schema_answers for select to authenticated using ((select auth.uid()) = user_id);
create policy "repondre a ses schemas" on public.study_schema_answers for insert to authenticated with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.study_schemas s where s.id = schema_id and s.user_id = (select auth.uid()))
);
revoke all on public.study_schema_answers from anon;

-- Les images : privées, une par schéma, rangées sous l'identifiant de la personne. 3 Mo au plus, JPEG seulement
-- (le navigateur réenregistre l'image, ce qui retire aussi ses données GPS).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('schemas', 'schemas', false, 3145728, array['image/jpeg']);
create policy "lire ses images de schemas" on storage.objects for select to authenticated
  using (bucket_id = 'schemas' and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}\.jpg$'));
create policy "creer ses images de schemas" on storage.objects for insert to authenticated
  with check (bucket_id = 'schemas' and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}\.jpg$'));
create policy "remplacer ses images de schemas" on storage.objects for update to authenticated
  using (bucket_id = 'schemas' and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}\.jpg$'))
  with check (bucket_id = 'schemas' and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}\.jpg$'));
create policy "supprimer ses images de schemas" on storage.objects for delete to authenticated
  using (bucket_id = 'schemas' and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}\.jpg$'));
