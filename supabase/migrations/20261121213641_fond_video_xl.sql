-- Le bucket standard reste plafonné à 20 Mo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fonds-video-xl', 'fonds-video-xl', false, 314572800, array['video/mp4', 'video/webm', 'video/quicktime']);

-- Le droit est accordé par un administrateur dans auth.users.raw_app_meta_data.
create policy "gerer sa video de fond xl" on storage.objects for all to authenticated
  using (
    bucket_id = 'fonds-video-xl'
    and name = (select auth.uid())::text || '/fond'
    and (select auth.jwt() -> 'app_metadata' -> 'fonds_video_xl') = 'true'::jsonb
  )
  with check (
    bucket_id = 'fonds-video-xl'
    and name = (select auth.uid())::text || '/fond'
    and (select auth.jwt() -> 'app_metadata' -> 'fonds_video_xl') = 'true'::jsonb
  );
