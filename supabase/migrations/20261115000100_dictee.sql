-- Widget « Dictée » (labo) : sa note s'enregistre dans widget_state, comme le widget Notes (64 Ko au plus par ligne,
-- déjà plafonné par widget_state_taille). Seul changement : « dictee » rejoint la liste des widgets autorisés.
-- Rien n'est enregistré de la voix : seulement le texte de la note.

alter table public.widget_state drop constraint widget_state_widget_check;
alter table public.widget_state add constraint widget_state_widget_check
  check (widget in ('ecran', 'notes', 'taches', 'minuteur', 'habitudes', 'vol', 'ambiance', 'compte', 'raccourcis', 'playlist', 'lecture', 'inspiration', 'cahier', 'cartes', 'revisions', 'quiz', 'schemas', 'guide',
                    'jardin', 'dessin', 'coloriage', 'puzzle', 'tangram', 'fenetre', 'ambiances', 'repas', 'dictee'));
