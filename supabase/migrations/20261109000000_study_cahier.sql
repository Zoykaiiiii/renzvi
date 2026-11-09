-- Study S1 : le widget Cahier. Un cours = une ligne (matière, titre, chapitres) + ses fichiers dans le stockage privé « cours ».
-- Le texte extrait n'est pas en base : il est dans <utilisateur>/<cours>/texte.json, à côté de l'original jamais modifié.

alter table public.widget_state drop constraint widget_state_widget_check;
alter table public.widget_state add constraint widget_state_widget_check
  check (widget in ('ecran', 'notes', 'taches', 'minuteur', 'habitudes', 'vol', 'ambiance', 'compte', 'raccourcis', 'playlist', 'lecture', 'inspiration', 'cahier'));

create table public.study_courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject text not null check (char_length(subject) between 1 and 60),
  title text not null check (char_length(title) between 1 and 120),
  kind text not null check (kind in ('pdf', 'texte')),
  file_name text not null check (char_length(file_name) between 1 and 200),
  file_size integer not null check (file_size between 1 and 20971520),
  page_count integer not null check (page_count between 1 and 200),
  text_chars integer not null check (text_chars >= 0),
  -- [{ id, title, page, offset }] : la page et la position du début de chaque chapitre dans le texte extrait.
  chapters jsonb not null default '[]' check (jsonb_typeof(chapters) = 'array' and pg_column_size(chapters) <= 32768),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index study_courses_user on public.study_courses (user_id, created_at);

alter table public.study_courses enable row level security;

create policy "lire ses cours" on public.study_courses
  for select to authenticated using ((select auth.uid()) = user_id);
-- 30 cours au plus par personne, pour borner le stockage.
create policy "creer ses cours" on public.study_courses
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (select count(*) from public.study_courses c where c.user_id = (select auth.uid())) < 30
  );
create policy "modifier ses cours" on public.study_courses
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "supprimer ses cours" on public.study_courses
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.study_courses from anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cours', 'cours', false, 20971520, array['application/pdf', 'text/plain', 'application/json']);

-- Seuls trois noms sont permis, rangés sous l'identifiant de la personne : personne ne lit ni n'écrit chez un autre.
create policy "lire ses cours (fichiers)" on storage.objects for select to authenticated
  using (bucket_id = 'cours' and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}/(original\.(pdf|txt)|texte\.json)$'));
create policy "creer ses cours (fichiers)" on storage.objects for insert to authenticated
  with check (bucket_id = 'cours' and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}/(original\.(pdf|txt)|texte\.json)$'));
create policy "remplacer ses cours (fichiers)" on storage.objects for update to authenticated
  using (bucket_id = 'cours' and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}/(original\.(pdf|txt)|texte\.json)$'))
  with check (bucket_id = 'cours' and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}/(original\.(pdf|txt)|texte\.json)$'));
create policy "supprimer ses cours (fichiers)" on storage.objects for delete to authenticated
  using (bucket_id = 'cours' and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}/(original\.(pdf|txt)|texte\.json)$'));
