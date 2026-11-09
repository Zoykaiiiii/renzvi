-- Study S8 : le widget Guide Study garde seulement deux petits réglages (chapitres vérifiés, guide masqué) dans
-- widget_state. Sa progression vient des vraies données : cours, cartes et réponses enregistrés.
alter table public.widget_state drop constraint widget_state_widget_check;
alter table public.widget_state add constraint widget_state_widget_check
  check (widget in ('ecran', 'notes', 'taches', 'minuteur', 'habitudes', 'vol', 'ambiance', 'compte', 'raccourcis', 'playlist', 'lecture', 'inspiration', 'cahier', 'cartes', 'revisions', 'quiz', 'schemas', 'guide'));
