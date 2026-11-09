-- Study S3 : révisions du jour et répétition espacée (FSRS, bibliothèque ts-fsrs 5.4.2, licence MIT).
-- Chaque carte garde son état de planification (fsrs) et sa prochaine échéance (due). Une carte jamais révisée n'a ni
-- l'un ni l'autre : elle est « nouvelle ». Le calcul se fait dans le navigateur, sans IA ; la base garde le résultat.

alter table public.study_cards
  add column fsrs jsonb check (fsrs is null or (jsonb_typeof(fsrs) = 'object' and pg_column_size(fsrs) <= 1024)),
  add column due timestamptz;
create index study_cards_due on public.study_cards (user_id, due);

-- Une carte modifiée sur le fond redevient nouvelle : sa planification ne valait que pour l'ancienne version.
create or replace function public.study_cards_version() returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.kind, new.front, new.back, new.holes) is distinct from (old.kind, old.front, old.back, old.holes) then
    new.version := old.version + 1;
    new.last_rating := null;
    new.last_reviewed_at := null;
    new.fsrs := null;
    new.due := null;
  else
    new.version := old.version;
  end if;
  new.user_id := old.user_id;
  new.updated_at := now();
  return new;
end $$;

-- Enregistre une réponse et la nouvelle échéance en une seule fois. p_prev est la date de la dernière réponse connue
-- par l'onglet : si un autre onglet a répondu entre-temps, ou si la carte a changé, rien n'est écrit et la fonction
-- renvoie null (l'onglet recharge la carte). Un double clic ne compte donc qu'une fois.
create function public.study_answer(p_card uuid, p_version integer, p_prev timestamptz, p_rating smallint, p_fsrs jsonb, p_due timestamptz)
returns timestamptz language plpgsql security invoker set search_path = '' as $$
declare
  stamp timestamptz := now();
begin
  update public.study_cards
    set fsrs = p_fsrs, due = p_due, last_rating = p_rating, last_reviewed_at = stamp
    where id = p_card and user_id = (select auth.uid()) and version = p_version and last_reviewed_at is not distinct from p_prev;
  if not found then return null; end if;
  insert into public.study_reviews (card_id, card_version, rating, reviewed_at) values (p_card, p_version, p_rating, stamp);
  return stamp;
end $$;
revoke all on function public.study_answer from public, anon;
grant execute on function public.study_answer to authenticated;

alter table public.widget_state drop constraint widget_state_widget_check;
alter table public.widget_state add constraint widget_state_widget_check
  check (widget in ('ecran', 'notes', 'taches', 'minuteur', 'habitudes', 'vol', 'ambiance', 'compte', 'raccourcis', 'playlist', 'lecture', 'inspiration', 'cahier', 'cartes', 'revisions'));
