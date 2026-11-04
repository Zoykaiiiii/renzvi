alter table public.widget_state drop constraint widget_state_widget_check;
alter table public.widget_state add constraint widget_state_widget_check
  check (widget in ('ecran', 'notes', 'taches', 'minuteur', 'habitudes', 'vol', 'ambiance', 'compte', 'raccourcis', 'playlist', 'lecture', 'inspiration'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inspiration', 'inspiration', false, 524288, array['image/jpeg']);

create policy "lire ses images d'inspiration" on storage.objects for select to authenticated
  using (bucket_id = 'inspiration' and name ~ ('^' || (select auth.uid())::text || '/[1-6]\.jpg$'));
create policy "creer ses images d'inspiration" on storage.objects for insert to authenticated
  with check (bucket_id = 'inspiration' and name ~ ('^' || (select auth.uid())::text || '/[1-6]\.jpg$'));
create policy "remplacer ses images d'inspiration" on storage.objects for update to authenticated
  using (bucket_id = 'inspiration' and name ~ ('^' || (select auth.uid())::text || '/[1-6]\.jpg$'))
  with check (bucket_id = 'inspiration' and name ~ ('^' || (select auth.uid())::text || '/[1-6]\.jpg$'));
create policy "supprimer ses images d'inspiration" on storage.objects for delete to authenticated
  using (bucket_id = 'inspiration' and name ~ ('^' || (select auth.uid())::text || '/[1-6]\.jpg$'));
