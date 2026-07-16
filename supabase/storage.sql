-- Apka Saathi — Supabase Storage (profile photo).
-- Supabase SQL Editor me Run karo. (Dobara run safe.)

/* ------------------------------------------------------------------ */
/* 1. Avatars bucket — profile photo (public read, 2MB tak)            */
/* ------------------------------------------------------------------ */
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- Photo har user ke apne folder me: avatars/<uid>/avatar.jpg
-- Read sabko (public URL), likhna/badalna/delete sirf apne folder me.
drop policy if exists "avatar public read" on storage.objects;
create policy "avatar public read" on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatar own write" on storage.objects;
create policy "avatar own write" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar own update" on storage.objects;
create policy "avatar own update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar own delete" on storage.objects;
create policy "avatar own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

/* ------------------------------------------------------------------ */
/* 2. Profile photo URL                                                 */
/* ------------------------------------------------------------------ */
alter table public.user_details add column if not exists avatar_url text;

/* ------------------------------------------------------------------ */
/* 3. Documents bucket — PRIVATE (passport/insurance etc.)             */
/* ------------------------------------------------------------------ */
-- Public NAHI — documents sensitive hote hain. Dekhne ke liye signed URL.
-- 10 MB tak; image + pdf.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760,
        array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760,
      allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'];

-- Sirf apne folder — read/write/delete. documents/<uid>/<docId>.jpg
drop policy if exists "doc own read" on storage.objects;
create policy "doc own read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "doc own write" on storage.objects;
create policy "doc own write" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "doc own update" on storage.objects;
create policy "doc own update" on storage.objects for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "doc own delete" on storage.objects;
create policy "doc own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

/* ------------------------------------------------------------------ */
/* 4. Documents table — storage ka path + size + type                  */
/* ------------------------------------------------------------------ */
alter table public.documents add column if not exists file_path text;
alter table public.documents add column if not exists file_size bigint;
alter table public.documents add column if not exists mime_type text;
