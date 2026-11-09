-- Study S2 : les flashcards. Une carte = une ligne, rangée dans un paquet (un simple nom), avec si elle vient du cahier
-- la référence du passage (cours, page, position, longueur). Le cours n'est jamais recopié : la carte garde seulement
-- la question, la réponse ou la phrase à trous. Chaque réponse donnée est gardée dans study_reviews pour la répétition
-- espacée de S3, avec la version de la carte à laquelle elle répond.

alter table public.widget_state drop constraint widget_state_widget_check;
alter table public.widget_state add constraint widget_state_widget_check
  check (widget in ('ecran', 'notes', 'taches', 'minuteur', 'habitudes', 'vol', 'ambiance', 'compte', 'raccourcis', 'playlist', 'lecture', 'inspiration', 'cahier', 'cartes'));

create table public.study_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  deck text not null check (char_length(deck) between 1 and 60),
  -- qa : question (front) et réponse (back). trou : la phrase (front) et les passages masqués (holes, [[début, fin]]).
  kind text not null check (kind in ('qa', 'trou')),
  front text not null check (char_length(front) between 1 and 1000),
  back text not null default '' check (char_length(back) <= 2000),
  holes jsonb not null default '[]' check (jsonb_typeof(holes) = 'array' and jsonb_array_length(holes) <= 20),
  -- Le cours supprimé, la carte reste : elle perd seulement son lien vers le passage.
  course_id uuid references public.study_courses (id) on delete set null,
  src_page integer check (src_page between 0 and 199),
  src_offset integer check (src_offset >= 0),
  src_length integer check (src_length between 0 and 5000),
  version integer not null default 1,
  last_rating smallint check (last_rating between 1 and 4),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'qa' and char_length(back) >= 1) or (kind = 'trou' and jsonb_array_length(holes) >= 1))
);
create index study_cards_user on public.study_cards (user_id, deck, created_at);
create index study_cards_course on public.study_cards (course_id);

-- Une carte modifiée sur le fond devient une nouvelle version : ses anciennes réponses ne comptent plus pour elle.
create function public.study_cards_version() returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.kind, new.front, new.back, new.holes) is distinct from (old.kind, old.front, old.back, old.holes) then
    new.version := old.version + 1;
    new.last_rating := null;
    new.last_reviewed_at := null;
  else
    new.version := old.version;
  end if;
  new.user_id := old.user_id;
  new.updated_at := now();
  return new;
end $$;
create trigger study_cards_version before update on public.study_cards
  for each row execute function public.study_cards_version();

alter table public.study_cards enable row level security;

create policy "lire ses cartes" on public.study_cards
  for select to authenticated using ((select auth.uid()) = user_id);
-- 3000 cartes au plus par personne. Un import envoie 500 cartes au plus d'un coup.
create policy "creer ses cartes" on public.study_cards
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (course_id is null or exists (select 1 from public.study_courses c where c.id = course_id and c.user_id = (select auth.uid())))
    and (select count(*) from public.study_cards c where c.user_id = (select auth.uid())) < 3000
  );
create policy "modifier ses cartes" on public.study_cards
  for update to authenticated using ((select auth.uid()) = user_id) with check (
    (select auth.uid()) = user_id
    and (course_id is null or exists (select 1 from public.study_courses c where c.id = course_id and c.user_id = (select auth.uid())))
  );
create policy "supprimer ses cartes" on public.study_cards
  for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.study_cards from anon;

create table public.study_reviews (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id uuid not null references public.study_cards (id) on delete cascade,
  card_version integer not null,
  -- 1 à revoir, 2 difficile, 3 je savais, 4 facile : l'échelle de la répétition espacée de S3. S2 n'utilise que 1 et 3.
  rating smallint not null check (rating between 1 and 4),
  reviewed_at timestamptz not null default now()
);
create index study_reviews_card on public.study_reviews (card_id, reviewed_at);
create index study_reviews_user on public.study_reviews (user_id, reviewed_at);

-- La dernière réponse est recopiée sur la carte, seulement si elle répond à sa version actuelle.
create function public.study_reviews_last() returns trigger language plpgsql set search_path = '' as $$
begin
  update public.study_cards set last_rating = new.rating, last_reviewed_at = new.reviewed_at
    where id = new.card_id and version = new.card_version;
  return new;
end $$;
create trigger study_reviews_last after insert on public.study_reviews
  for each row execute function public.study_reviews_last();

alter table public.study_reviews enable row level security;
create policy "lire ses reponses" on public.study_reviews
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "repondre a ses cartes" on public.study_reviews
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.study_cards c where c.id = card_id and c.user_id = (select auth.uid()))
  );
revoke all on public.study_reviews from anon;
