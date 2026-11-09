-- Chill (labo) : les nouveaux widgets Chill enregistrent leur petit état dans widget_state (64 Ko au plus par ligne,
-- déjà plafonné par widget_state_taille), et les dessins de l'atelier dans un stockage privé à part.
-- Préparée le 9 nov. 2026, PAS encore appliquée sur la base en ligne : à passer par Damien dans l'éditeur SQL.

-- 1. Les identifiants autorisés : la liste du lot S8, plus les widgets Chill du labo.
alter table public.widget_state drop constraint widget_state_widget_check;
alter table public.widget_state add constraint widget_state_widget_check
  check (widget in ('ecran', 'notes', 'taches', 'minuteur', 'habitudes', 'vol', 'ambiance', 'compte', 'raccourcis', 'playlist', 'lecture', 'inspiration', 'cahier', 'cartes', 'revisions', 'quiz', 'schemas', 'guide',
                    'jardin', 'dessin', 'coloriage', 'puzzle', 'tangram', 'fenetre', 'ambiances'));

-- 2. Les dessins : privés, un dossier par compte, 12 fichiers PNG au plus (noms 1.png à 12.png), 1,5 Mo chacun au plus.
-- Le nombre est borné par le nom imposé, la taille et le type par le bucket : rien ne dépend de l'interface.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dessins', 'dessins', false, 1572864, array['image/png']);

create policy "lire ses dessins" on storage.objects for select to authenticated
  using (bucket_id = 'dessins' and name ~ ('^' || (select auth.uid())::text || '/([1-9]|1[0-2])\.png$'));
create policy "creer ses dessins" on storage.objects for insert to authenticated
  with check (bucket_id = 'dessins' and name ~ ('^' || (select auth.uid())::text || '/([1-9]|1[0-2])\.png$'));
create policy "remplacer ses dessins" on storage.objects for update to authenticated
  using (bucket_id = 'dessins' and name ~ ('^' || (select auth.uid())::text || '/([1-9]|1[0-2])\.png$'))
  with check (bucket_id = 'dessins' and name ~ ('^' || (select auth.uid())::text || '/([1-9]|1[0-2])\.png$'));
create policy "supprimer ses dessins" on storage.objects for delete to authenticated
  using (bucket_id = 'dessins' and name ~ ('^' || (select auth.uid())::text || '/([1-9]|1[0-2])\.png$'));
