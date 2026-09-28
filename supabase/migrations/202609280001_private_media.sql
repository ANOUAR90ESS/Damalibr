-- Phase 0: generated media must not be publicly readable.
-- The application server uses the service role to upload/download and creates
-- short-lived signed URLs after authenticating the requesting user.

insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do update set public = false;

-- Remove broad public read policies if they exist. The service role bypasses
-- RLS, while the application exposes media through /api/media.
drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Public media read" on storage.objects;
drop policy if exists "Public media read access" on storage.objects;
drop policy if exists "Public read media" on storage.objects;
