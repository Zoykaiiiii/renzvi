-- Study S6 : le quiz. Une question à choix multiples (une ou plusieurs bonnes réponses), écrite à la main, importée ou
-- générée depuis le Cahier, avec si possible son passage source. Chaque réponse donnée est gardée avec la version de la
-- question : une question corrigée ne mélange pas ses anciennes réponses avec les nouvelles.
-- La correction d'un QCM se fait dans le navigateur, sans IA.

alter table public.widget_state drop constraint widget_state_widget_check;
alter table public.widget_state add constraint widget_state_widget_check
  check (widget in ('ecran', 'notes', 'taches', 'minuteur', 'habitudes', 'vol', 'ambiance', 'compte', 'raccourcis', 'playlist', 'lecture', 'inspiration', 'cahier', 'cartes', 'revisions', 'quiz'));

create table public.study_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  deck text not null check (char_length(deck) between 1 and 60),
  question text not null check (char_length(question) between 1 and 600),
  -- 2 à 6 choix ; bonnes = les positions des bonnes réponses dans choix.
  choix jsonb not null check (jsonb_typeof(choix) = 'array' and jsonb_array_length(choix) between 2 and 6 and pg_column_size(choix) <= 4096),
  bonnes jsonb not null check (jsonb_typeof(bonnes) = 'array' and jsonb_array_length(bonnes) between 1 and 6),
  explication text not null default '' check (char_length(explication) <= 1000),
  course_id uuid references public.study_courses (id) on delete set null,
  src_page integer check (src_page between 0 and 199),
  src_offset integer check (src_offset >= 0),
  src_length integer check (src_length between 0 and 5000),
  version integer not null default 1,
  -- Signalée comme fausse par la personne : à corriger avant de compter.
  signalee boolean not null default false,
  derniere_reussie boolean,
  derniere_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index study_questions_user on public.study_questions (user_id, deck, created_at);

create function public.study_questions_version() returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.question, new.choix, new.bonnes) is distinct from (old.question, old.choix, old.bonnes) then
    new.version := old.version + 1;
    new.derniere_reussie := null;
    new.derniere_at := null;
    new.signalee := false;
  else
    new.version := old.version;
  end if;
  new.user_id := old.user_id;
  new.updated_at := now();
  return new;
end $$;
create trigger study_questions_version before update on public.study_questions
  for each row execute function public.study_questions_version();

alter table public.study_questions enable row level security;
create policy "lire ses questions" on public.study_questions for select to authenticated using ((select auth.uid()) = user_id);
-- 3000 questions au plus par personne.
create policy "creer ses questions" on public.study_questions for insert to authenticated with check (
  (select auth.uid()) = user_id
  and (course_id is null or exists (select 1 from public.study_courses c where c.id = course_id and c.user_id = (select auth.uid())))
  and (select count(*) from public.study_questions q where q.user_id = (select auth.uid())) < 3000
);
create policy "modifier ses questions" on public.study_questions for update to authenticated using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and (course_id is null or exists (select 1 from public.study_courses c where c.id = course_id and c.user_id = (select auth.uid())))
);
create policy "supprimer ses questions" on public.study_questions for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.study_questions from anon;

create table public.study_quiz_answers (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  question_id uuid not null references public.study_questions (id) on delete cascade,
  question_version integer not null,
  donnees jsonb not null check (jsonb_typeof(donnees) = 'array' and jsonb_array_length(donnees) <= 6),
  reussie boolean not null,
  created_at timestamptz not null default now()
);
create index study_quiz_answers_question on public.study_quiz_answers (question_id, created_at);

-- La dernière réponse est recopiée sur la question, seulement si elle répond à sa version actuelle.
create function public.study_quiz_answers_last() returns trigger language plpgsql set search_path = '' as $$
begin
  update public.study_questions set derniere_reussie = new.reussie, derniere_at = new.created_at
    where id = new.question_id and version = new.question_version;
  return new;
end $$;
create trigger study_quiz_answers_last after insert on public.study_quiz_answers
  for each row execute function public.study_quiz_answers_last();

alter table public.study_quiz_answers enable row level security;
create policy "lire ses reponses de quiz" on public.study_quiz_answers for select to authenticated using ((select auth.uid()) = user_id);
create policy "repondre a ses questions" on public.study_quiz_answers for insert to authenticated with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.study_questions q where q.id = question_id and q.user_id = (select auth.uid()))
);
revoke all on public.study_quiz_answers from anon;
