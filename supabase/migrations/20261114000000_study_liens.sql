-- Présentations Study, lot 1 (Arbre) : le socle commun aux cinq présentations.
-- Deux petites tables, rien d'existant n'est modifié ni supprimé.
--
-- study_links : un chapitre d'un cours associé à un paquet de flashcards. C'est une référence : aucune carte n'est
-- copiée. Un paquet est un nom (study_cards.deck), comme dans le widget Flashcards. Retirer une association ne
-- supprime ni le paquet ni ses cartes. Le cours supprimé, ses associations partent avec lui.
-- study_notes : une note par chapitre, partagée par toutes les présentations.

create table public.study_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null references public.study_courses (id) on delete cascade,
  chapter_id text not null check (char_length(chapter_id) between 1 and 40),
  deck text not null check (char_length(deck) between 1 and 60),
  created_at timestamptz not null default now(),
  -- Pas deux fois la même association.
  unique (user_id, course_id, chapter_id, deck)
);

alter table public.study_links enable row level security;
create policy "lire ses associations" on public.study_links
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "creer ses associations" on public.study_links
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.study_courses c where c.id = course_id and c.user_id = (select auth.uid()))
  );
create policy "supprimer ses associations" on public.study_links
  for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.study_links from anon;

create trigger study_links_quota after insert on public.study_links referencing new table as nouveaux
  for each statement execute function public.study_quota('500');

create table public.study_notes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null references public.study_courses (id) on delete cascade,
  chapter_id text not null check (char_length(chapter_id) between 1 and 40),
  body text not null check (char_length(body) between 1 and 8000),
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id, chapter_id)
);

alter table public.study_notes enable row level security;
create policy "lire ses notes de cours" on public.study_notes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "creer ses notes de cours" on public.study_notes
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.study_courses c where c.id = course_id and c.user_id = (select auth.uid()))
  );
create policy "modifier ses notes de cours" on public.study_notes
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "supprimer ses notes de cours" on public.study_notes
  for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.study_notes from anon;

create trigger study_notes_quota after insert on public.study_notes referencing new table as nouveaux
  for each statement execute function public.study_quota('2500');
