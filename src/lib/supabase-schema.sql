-- ====================================================================
-- LÁMINA - Database Schema & Row Level Security (Supabase PostgreSQL)
-- ====================================================================

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Books Table (Public-Domain Classics)
CREATE TABLE IF NOT EXISTS public.books (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  year INTEGER NOT NULL,
  language TEXT NOT NULL DEFAULT 'es',
  cover_url TEXT NOT NULL,
  backdrop_url TEXT NOT NULL,
  synopsis TEXT NOT NULL,
  source_text_url TEXT,
  genres TEXT[] NOT NULL DEFAULT '{}',
  era TEXT NOT NULL DEFAULT 'Clásicos',
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('draft', 'ready', 'archived')),
  rating NUMERIC(3, 2) DEFAULT 4.8,
  total_views BIGINT DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  kids_friendly BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Characters Table
CREATE TABLE IF NOT EXISTS public.characters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('protagonista', 'antagonista', 'secundario', 'narrador')),
  personality TEXT,
  gender TEXT DEFAULT 'neutro',
  age_range TEXT,
  voice_id TEXT NOT NULL,
  voice_name TEXT NOT NULL,
  avatar_url TEXT NOT NULL,
  reference_images TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Adaptations Table ('drama', 'film', 'summary')
CREATE TABLE IF NOT EXISTS public.adaptations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  format TEXT NOT NULL CHECK (format IN ('drama', 'film', 'summary')),
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('processing', 'ready', 'draft')),
  total_duration INTEGER NOT NULL DEFAULT 0, -- in seconds
  episode_count INTEGER NOT NULL DEFAULT 1,
  aspect_ratio TEXT NOT NULL DEFAULT '9:16' CHECK (aspect_ratio IN ('9:16', '16:9')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Episodes Table
CREATE TABLE IF NOT EXISTS public.episodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  adaptation_id UUID NOT NULL REFERENCES public.adaptations(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'drama',
  script_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  video_url TEXT NOT NULL,
  hls_url TEXT,
  thumbnail_url TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 90, -- in seconds
  is_free BOOLEAN NOT NULL DEFAULT false,
  coin_price INTEGER NOT NULL DEFAULT 10,
  story_position_start NUMERIC(5, 4) NOT NULL DEFAULT 0.0,
  story_position_end NUMERIC(5, 4) NOT NULL DEFAULT 1.0,
  cliffhanger TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. User Progress Table
CREATE TABLE IF NOT EXISTS public.user_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  adaptation_id UUID NOT NULL REFERENCES public.adaptations(id) ON DELETE CASCADE,
  episode_id UUID NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  seconds INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, adaptation_id, episode_id)
);

-- 7. Library Table ('to_watch', 'started', 'finished', downloads, bookmarks)
CREATE TABLE IF NOT EXISTS public.library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK (state IN ('to_watch', 'started', 'finished')),
  is_bookmarked BOOLEAN DEFAULT false,
  is_downloaded BOOLEAN DEFAULT false,
  download_size_mb NUMERIC(6, 2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, book_id)
);

-- 8. Subscriptions & Coin Wallet
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'vip')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  current_period_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.coin_wallet (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 50 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'spend', 'reward')),
  amount INTEGER NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Views Table (for Rankings by day, week, month, year)
CREATE TABLE IF NOT EXISTS public.views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  format TEXT NOT NULL DEFAULT 'drama',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. User Profiles (Extended user details, streaks, kids mode)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  kids_mode_enabled BOOLEAN DEFAULT false,
  kids_pin TEXT,
  language TEXT DEFAULT 'es-ES',
  daily_goal_minutes INTEGER DEFAULT 15,
  streak_days INTEGER DEFAULT 1,
  minutes_watched_today INTEGER DEFAULT 0,
  total_minutes_watched INTEGER DEFAULT 0,
  total_episodes_completed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adaptations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Catalog is publicly readable
CREATE POLICY "Public books read" ON public.books FOR SELECT USING (true);
CREATE POLICY "Public characters read" ON public.characters FOR SELECT USING (true);
CREATE POLICY "Public adaptations read" ON public.adaptations FOR SELECT USING (true);
CREATE POLICY "Public episodes read" ON public.episodes FOR SELECT USING (true);

-- User Progress: users can only manage their own progress
CREATE POLICY "User progress select" ON public.user_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "User progress insert" ON public.user_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User progress update" ON public.user_progress FOR UPDATE USING (auth.uid() = user_id);

-- Library: users manage their own library
CREATE POLICY "User library select" ON public.library FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "User library insert" ON public.library FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User library update" ON public.library FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "User library delete" ON public.library FOR DELETE USING (auth.uid() = user_id);

-- Wallet & Subscriptions
CREATE POLICY "User wallet select" ON public.coin_wallet FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "User transactions select" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "User subscriptions select" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Profiles
CREATE POLICY "Public profiles read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Views insert
CREATE POLICY "Anyone can record views" ON public.views FOR INSERT WITH CHECK (true);
CREATE POLICY "Public view counts" ON public.views FOR SELECT USING (true);
