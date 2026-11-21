-- Retire le plafond de 20 Mo du bucket fonds-video.
-- La limite globale de Supabase Storage reste applicable.
update storage.buckets
set file_size_limit = null
where id = 'fonds-video';
