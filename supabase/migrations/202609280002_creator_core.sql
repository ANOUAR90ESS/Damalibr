-- Phase 1: Creator Studio core domain.
create extension if not exists pgcrypto;

create table if not exists public.creator_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  type text not null check (type in ('story','book','series','short_film','microdrama','audiobook')),
  status text not null default 'draft' check (status in ('draft','processing','ready','published','archived')),
  description text,
  language text not null default 'es',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_episodes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.creator_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  status text not null default 'draft' check (status in ('draft','processing','ready','published','archived')),
  script jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_characters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.creator_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  personality text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_scenes (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.creator_episodes(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  scene_order integer not null default 0,
  title text,
  script jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_projects_owner_idx on public.creator_projects(owner_id, updated_at desc);
create index if not exists creator_episodes_project_idx on public.creator_episodes(project_id, created_at);
create index if not exists creator_characters_project_idx on public.creator_characters(project_id);
create index if not exists creator_scenes_episode_idx on public.creator_scenes(episode_id, scene_order);

alter table public.creator_projects enable row level security;
alter table public.creator_episodes enable row level security;
alter table public.creator_characters enable row level security;
alter table public.creator_scenes enable row level security;

drop policy if exists "creator projects owner" on public.creator_projects;
create policy "creator projects owner" on public.creator_projects for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "creator episodes owner" on public.creator_episodes;
create policy "creator episodes owner" on public.creator_episodes for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "creator characters owner" on public.creator_characters;
create policy "creator characters owner" on public.creator_characters for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "creator scenes owner" on public.creator_scenes;
create policy "creator scenes owner" on public.creator_scenes for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create or replace function public.set_creator_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists creator_projects_updated_at on public.creator_projects;
create trigger creator_projects_updated_at before update on public.creator_projects for each row execute function public.set_creator_updated_at();
drop trigger if exists creator_episodes_updated_at on public.creator_episodes;
create trigger creator_episodes_updated_at before update on public.creator_episodes for each row execute function public.set_creator_updated_at();
drop trigger if exists creator_characters_updated_at on public.creator_characters;
create trigger creator_characters_updated_at before update on public.creator_characters for each row execute function public.set_creator_updated_at();
drop trigger if exists creator_scenes_updated_at on public.creator_scenes;
create trigger creator_scenes_updated_at before update on public.creator_scenes for each row execute function public.set_creator_updated_at();
