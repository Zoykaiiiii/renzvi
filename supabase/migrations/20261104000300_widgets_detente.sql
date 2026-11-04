-- Déjà appliquée sur le projet Supabase de Renzvi : autorise les trois widgets qui enregistrent des données.
-- (La respiration guidée n'enregistre rien, comme l'Heure.) Les règles de sécurité par utilisateur ne changent pas.
alter table public.widget_state drop constraint widget_state_widget_check;
alter table public.widget_state add constraint widget_state_widget_check
  check (widget in ('ecran', 'notes', 'taches', 'minuteur', 'habitudes', 'vol', 'ambiance', 'compte', 'raccourcis'));
