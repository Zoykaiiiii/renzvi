-- Déjà appliquée sur le projet Supabase de Renzvi. Une ligne par utilisateur et par widget.
-- La liste des widgets et la taille sont plafonnées pour borner le stockage par utilisateur.
create table public.widget_state (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  widget text not null check (widget in ('notes', 'taches', 'minuteur', 'habitudes')),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, widget),
  constraint widget_state_taille check (pg_column_size(data) <= 65536)
);

alter table public.widget_state enable row level security;

create policy "lire ses widgets" on public.widget_state
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "creer ses widgets" on public.widget_state
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "modifier ses widgets" on public.widget_state
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "supprimer ses widgets" on public.widget_state
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.widget_state from anon;
