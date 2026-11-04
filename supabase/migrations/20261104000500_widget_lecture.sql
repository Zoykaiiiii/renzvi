alter table public.widget_state drop constraint widget_state_widget_check;
alter table public.widget_state add constraint widget_state_widget_check
  check (widget in ('ecran', 'notes', 'taches', 'minuteur', 'habitudes', 'vol', 'ambiance', 'compte', 'raccourcis', 'playlist', 'lecture'));
