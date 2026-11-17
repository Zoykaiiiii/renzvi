-- Fond d'écran en vidéo (Personnaliser → Fond → Ta vidéo). PAS ENCORE APPLIQUÉE sur le projet Supabase.
-- Un seul fichier privé par compte, <compte>/fond, 20 Mo au plus, MP4, WebM ou MOV (iPhone).
-- Bucket à part : celui des photos garde sa limite de 3 Mo et son seul JPEG.
-- Réservé à Pro dans l'interface (cadenas), comme les polices : la base ne vérifie pas le plan.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fonds-video', 'fonds-video', false, 20971520, array['video/mp4', 'video/webm', 'video/quicktime']);

create policy "lire sa video de fond" on storage.objects for select to authenticated
  using (bucket_id = 'fonds-video' and name = (select auth.uid())::text || '/fond');
create policy "creer sa video de fond" on storage.objects for insert to authenticated
  with check (bucket_id = 'fonds-video' and name = (select auth.uid())::text || '/fond');
create policy "remplacer sa video de fond" on storage.objects for update to authenticated
  using (bucket_id = 'fonds-video' and name = (select auth.uid())::text || '/fond')
  with check (bucket_id = 'fonds-video' and name = (select auth.uid())::text || '/fond');
create policy "supprimer sa video de fond" on storage.objects for delete to authenticated
  using (bucket_id = 'fonds-video' and name = (select auth.uid())::text || '/fond');
