create table if not exists public.production_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.creator_projects(id) on delete cascade,
  episode_id uuid references public.creator_episodes(id) on delete cascade,
  type text not null check (type in ('story.generate','characters.generate','script.generate','scenes.generate','image.generate','voice.generate','video.generate','subtitle.generate','video.render','export.create')),
  status text not null default 'queued' check (status in ('queued','running','paused','completed','failed','cancelled')),
  progress integer not null default 0 check (progress between 0 and 100),
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error text,
  queue_job_id text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists production_jobs_owner_idx on public.production_jobs(owner_id, created_at desc);
create index if not exists production_jobs_project_idx on public.production_jobs(project_id, created_at desc);
create index if not exists production_jobs_queue_idx on public.production_jobs(queue_job_id);

alter table public.production_jobs enable row level security;
create policy "production_jobs_owner_all" on public.production_jobs
for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create or replace function public.set_production_job_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists production_jobs_updated_at on public.production_jobs;
create trigger production_jobs_updated_at before update on public.production_jobs
for each row execute function public.set_production_job_updated_at();
