-- Nutrition (labo) : le widget « repas » enregistre son petit état dans widget_state.
-- RECONSTITUÉ le 15 nov. 2026 : le fichier avait été commité vide (un seul caractère) alors que la vraie migration
-- avait été passée à la main sur la base en ligne le 10 nov. Contenu déduit de la liste attendue par tests/rls.check.sql
-- et du modèle de 20261109000800_chill_labo.sql. NE PAS repasser en ligne.
-- Vérifié le 15 nov. 2026 sur la base en ligne : mêmes 26 widgets, dans le même ordre.

alter table public.widget_state drop constraint widget_state_widget_check;
alter table public.widget_state add constraint widget_state_widget_check
  check (widget in ('ecran', 'notes', 'taches', 'minuteur', 'habitudes', 'vol', 'ambiance', 'compte', 'raccourcis', 'playlist', 'lecture', 'inspiration', 'cahier', 'cartes', 'revisions', 'quiz', 'schemas', 'guide',
                    'jardin', 'dessin', 'coloriage', 'puzzle', 'tangram', 'fenetre', 'ambiances', 'repas'));
