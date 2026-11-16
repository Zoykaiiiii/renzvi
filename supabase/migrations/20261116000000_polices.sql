-- Polices personnelles (Personnaliser → Typographie → Mes polices). PAS ENCORE APPLIQUÉE sur le projet Supabase.
-- Fichiers privés, un par emplacement : <compte>/1 à <compte>/10, donc 10 polices au plus par compte, 3 Mo chacune.
-- Le nombre est borné par le nom imposé, la taille et le type par le bucket : rien ne dépend de l'interface.
-- La liste (noms, format, graisses) et le choix actif restent dans la ligne « ecran » de widget_state : aucune table nouvelle.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('polices', 'polices', false, 3145728, array['font/woff2', 'font/woff', 'font/ttf', 'font/otf']);

create policy "lire ses polices" on storage.objects for select to authenticated
  using (bucket_id = 'polices' and name ~ ('^' || (select auth.uid())::text || '/([1-9]|10)$'));
create policy "creer ses polices" on storage.objects for insert to authenticated
  with check (bucket_id = 'polices' and name ~ ('^' || (select auth.uid())::text || '/([1-9]|10)$'));
-- Remplacer : un emplacement libéré dont le fichier n'a pas pu être supprimé est réécrit à la prochaine importation.
create policy "remplacer ses polices" on storage.objects for update to authenticated
  using (bucket_id = 'polices' and name ~ ('^' || (select auth.uid())::text || '/([1-9]|10)$'))
  with check (bucket_id = 'polices' and name ~ ('^' || (select auth.uid())::text || '/([1-9]|10)$'));
create policy "supprimer ses polices" on storage.objects for delete to authenticated
  using (bucket_id = 'polices' and name ~ ('^' || (select auth.uid())::text || '/([1-9]|10)$'));
