create table if not exists public.creator_exports (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 project_id uuid not null references public.creator_projects(id) on delete cascade,
 episode_id uuid references public.creator_episodes(id) on delete cascade,
 job_id uuid references public.production_jobs(id) on delete set null,
 profile_id text not null,
 storage_key text,
 status text not null default 'queued' check (status in ('queued','processing','ready','failed')),
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
alter table public.creator_exports enable row level security;
create policy "creator exports owner" on public.creator_exports for all using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
create index if not exists creator_exports_episode_idx on public.creator_exports(episode_id, created_at desc);