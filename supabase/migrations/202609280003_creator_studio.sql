create table if not exists public.creator_media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.creator_projects(id) on delete cascade,
  episode_id uuid references public.creator_episodes(id) on delete cascade,
  kind text not null check (kind in ('image','audio','video','subtitle','thumbnail','other')),
  name text not null,
  storage_key text not null unique,
  mime_type text,
  size_bytes bigint,
  status text not null default 'ready' check (status in ('uploading','ready','processing','failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists creator_media_owner_idx on public.creator_media(owner_id);
create index if not exists creator_media_project_idx on public.creator_media(project_id);
create index if not exists creator_media_episode_idx on public.creator_media(episode_id);

alter table public.creator_media enable row level security;
create policy "creator_media_owner_all" on public.creator_media
for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
