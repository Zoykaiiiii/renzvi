-- Carnet (vue agrandie du Cahier) : annotations et signets d'un cours. Une table, rien d'existant n'est modifié.
--
-- Une annotation ne touche jamais au fichier importé : elle vise un passage du texte extrait (texte.json, écrit une
-- fois à l'import, jamais réécrit) par sa page, sa position et sa longueur, et garde le texte cité (quote).
-- Si le texte cité ne se retrouve plus à cet endroit, l'app le dit au lieu d'accrocher l'annotation ailleurs.
--   kind = 'passage' : surligne et/ou souligne et/ou note sur un passage.
--   kind = 'signet'  : un endroit où revenir (longueur 0, quote = les premiers mots à cet endroit).
-- Le cours supprimé, ses annotations partent avec lui.

create table public.study_annotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null references public.study_courses (id) on delete cascade,
  kind text not null check (kind in ('passage', 'signet')),
  page integer not null check (page between 0 and 999),
  pos integer not null check (pos >= 0),
  length integer not null check (length between 0 and 2000),
  quote text not null check (char_length(quote) <= 2000),
  surligne boolean not null default false,
  souligne boolean not null default false,
  color text not null default 'jaune' check (color in ('jaune', 'vert', 'bleu', 'rose')),
  note text check (note is null or char_length(note) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'signet' and length = 0 and not surligne and not souligne and note is null) or (kind = 'passage' and length > 0))
);
create index study_annotations_cours on public.study_annotations (user_id, course_id, page, pos);

alter table public.study_annotations enable row level security;
create policy "lire ses annotations" on public.study_annotations
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "creer ses annotations" on public.study_annotations
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.study_courses c where c.id = course_id and c.user_id = (select auth.uid()))
  );
create policy "modifier ses annotations" on public.study_annotations
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "supprimer ses annotations" on public.study_annotations
  for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.study_annotations from anon;

create trigger study_annotations_quota after insert on public.study_annotations referencing new table as nouveaux
  for each statement execute function public.study_quota('3000');
