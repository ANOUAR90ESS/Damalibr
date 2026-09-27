-- ====================================================================
-- LÁMINA - Database Schema & Row Level Security (Supabase PostgreSQL)
-- ====================================================================
-- Catalog ids (books, characters, adaptations, episodes) are TEXT slugs
-- such as 'book-quijote' or 'ep-q-1' so they match src/data/seedBooks.ts
-- and supabase/seed.sql. User-owned rows reference auth.users (UUID).

-- 1. Books Table (Public-Domain Classics)
CREATE TABLE IF NOT EXISTS public.books (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
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

-- 2. Characters Table
CREATE TABLE IF NOT EXISTS public.characters (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  book_id TEXT NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
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

-- 3. Adaptations Table ('drama', 'film', 'summary')
CREATE TABLE IF NOT EXISTS public.adaptations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  book_id TEXT NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  format TEXT NOT NULL CHECK (format IN ('drama', 'film', 'summary')),
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('processing', 'ready', 'draft')),
  total_duration INTEGER NOT NULL DEFAULT 0, -- in seconds
  episode_count INTEGER NOT NULL DEFAULT 1,
  description TEXT NOT NULL DEFAULT '',
  aspect_ratio TEXT NOT NULL DEFAULT '9:16' CHECK (aspect_ratio IN ('9:16', '16:9')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Episodes Table
CREATE TABLE IF NOT EXISTS public.episodes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  adaptation_id TEXT NOT NULL REFERENCES public.adaptations(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'drama' CHECK (format IN ('drama', 'film', 'summary')),
  script_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  video_url TEXT NOT NULL,
  hls_url TEXT,
  thumbnail_url TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 90, -- in seconds
  is_free BOOLEAN NOT NULL DEFAULT false,
  coin_price INTEGER NOT NULL DEFAULT 10 CHECK (coin_price >= 0),
  story_position_start NUMERIC(5, 4) NOT NULL DEFAULT 0.0,
  story_position_end NUMERIC(5, 4) NOT NULL DEFAULT 1.0,
  cliffhanger TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (adaptation_id, number)
);

-- 5. User Profiles (extended user details, streaks, kids mode, role)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  kids_mode_enabled BOOLEAN NOT NULL DEFAULT false,
  language TEXT NOT NULL DEFAULT 'es-ES' CHECK (language IN ('es-ES', 'es-LA')),
  daily_goal_minutes INTEGER NOT NULL DEFAULT 15,
  streak_days INTEGER NOT NULL DEFAULT 0,
  minutes_watched_today INTEGER NOT NULL DEFAULT 0,
  total_minutes_watched INTEGER NOT NULL DEFAULT 0,
  total_episodes_completed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. User Progress Table
CREATE TABLE IF NOT EXISTS public.user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  adaptation_id TEXT NOT NULL REFERENCES public.adaptations(id) ON DELETE CASCADE,
  episode_id TEXT NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  seconds INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, adaptation_id, episode_id)
);

-- 7. Library Table ('to_watch', 'started', 'finished', downloads, bookmarks)
CREATE TABLE IF NOT EXISTS public.library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK (state IN ('to_watch', 'started', 'finished')),
  is_bookmarked BOOLEAN NOT NULL DEFAULT false,
  is_downloaded BOOLEAN NOT NULL DEFAULT false,
  download_size_mb NUMERIC(8, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, book_id)
);

-- 8. Likes (books a user has liked)
CREATE TABLE IF NOT EXISTS public.likes (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, book_id)
);

-- 9. Subscriptions & Coin Wallet (written only by server-side code)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'vip')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.coin_wallet (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'spend', 'reward')),
  amount INTEGER NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Views Table (for rankings by day, week, month, year)
CREATE TABLE IF NOT EXISTS public.views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id TEXT NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  format TEXT NOT NULL DEFAULT 'drama',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS episodes_adaptation_idx ON public.episodes (adaptation_id, number);
CREATE INDEX IF NOT EXISTS adaptations_book_idx ON public.adaptations (book_id);
CREATE INDEX IF NOT EXISTS characters_book_idx ON public.characters (book_id);
CREATE INDEX IF NOT EXISTS views_book_created_idx ON public.views (book_id, created_at);

-- ====================================================================
-- NEW USER BOOTSTRAP
-- ====================================================================
-- Every new auth user gets a profile, a free subscription and a wallet
-- with the 60-coin welcome gift.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );

  INSERT INTO public.subscriptions (user_id, tier, status) VALUES (NEW.id, 'free', 'active');

  INSERT INTO public.coin_wallet (user_id, balance) VALUES (NEW.id, 60);
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (NEW.id, 'reward', 60, 'Bono de bienvenida Lámina (60 monedas gratis)');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper for admin-only policies and server checks
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adaptations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.views ENABLE ROW LEVEL SECURITY;

-- Catalog: everyone reads published content, admins manage it
CREATE POLICY "Public books read" ON public.books FOR SELECT USING (status = 'ready' OR public.is_admin());
CREATE POLICY "Public characters read" ON public.characters FOR SELECT USING (true);
CREATE POLICY "Public adaptations read" ON public.adaptations FOR SELECT USING (status = 'ready' OR public.is_admin());
CREATE POLICY "Public episodes read" ON public.episodes FOR SELECT USING (true);

CREATE POLICY "Admins manage books" ON public.books FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins manage characters" ON public.characters FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins manage adaptations" ON public.adaptations FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins manage episodes" ON public.episodes FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Profiles: private to their owner. Users may only edit their preferences
-- and stats; role changes require the service role.
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (
  display_name, avatar_url, kids_mode_enabled, language, daily_goal_minutes,
  streak_days, minutes_watched_today, total_minutes_watched, total_episodes_completed, updated_at
) ON public.profiles TO authenticated;

-- User Progress: users can only manage their own progress
CREATE POLICY "User progress select" ON public.user_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "User progress insert" ON public.user_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User progress update" ON public.user_progress FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Library: users manage their own library
CREATE POLICY "User library select" ON public.library FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "User library insert" ON public.library FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User library update" ON public.library FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User library delete" ON public.library FOR DELETE USING (auth.uid() = user_id);

-- Likes: users manage their own likes
CREATE POLICY "User likes select" ON public.likes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "User likes insert" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User likes delete" ON public.likes FOR DELETE USING (auth.uid() = user_id);

-- Wallet & Subscriptions: read-only for users (writes happen server-side)
CREATE POLICY "User wallet select" ON public.coin_wallet FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "User transactions select" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "User subscriptions select" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Views: anyone can record a view, but only for themselves (or anonymously)
CREATE POLICY "Anyone can record views" ON public.views FOR INSERT WITH CHECK (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Admins read views" ON public.views FOR SELECT USING (public.is_admin());
