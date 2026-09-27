-- ====================================================================
-- LÁMINA - AI production pipeline (admin only)
-- ====================================================================

-- Pipeline jobs are written and read only by the server (service role).
-- source_chapters holds the full cleaned text, kept apart from the job
-- state so progress updates stay small.
CREATE TABLE IF NOT EXISTS public.pipeline_jobs (
  id TEXT PRIMARY KEY,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  data JSONB NOT NULL,
  source_chapters JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pipeline_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pipeline_jobs FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS pipeline_jobs_created_idx ON public.pipeline_jobs (created_at DESC);

-- Public bucket for generated media (audio, images, MP4/HLS video).
-- Uploads happen only from the server with the service role.
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;
