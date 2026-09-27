-- ====================================================================
-- LÁMINA - Server-side economy (coins, unlocks, VIP) and kids PIN
-- ====================================================================
-- Clients can no longer change balances or VIP status. Episode unlocks go
-- through unlock_episode(); coin purchases and VIP subscriptions are written
-- by the Stripe webhook on the server using the service role.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Unlocked episodes
CREATE TABLE IF NOT EXISTS public.unlocked_episodes (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  episode_id TEXT NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, episode_id)
);

ALTER TABLE public.unlocked_episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User unlocks select" ON public.unlocked_episodes FOR SELECT USING (auth.uid() = user_id);

-- 2. Stripe payments (idempotency log for the webhook)
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_session_id TEXT NOT NULL UNIQUE,
  product TEXT NOT NULL,
  coins INTEGER NOT NULL DEFAULT 0,
  amount_cents INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User payments select" ON public.payments FOR SELECT USING (auth.uid() = user_id);

-- 3. Stripe references on subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE;

-- 4. Kids PIN: the hash lives in its own table with no client access at all,
--    so it cannot be read and brute-forced offline.
CREATE TABLE IF NOT EXISTS public.kids_pins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ
);
ALTER TABLE public.kids_pins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kids_pins FROM anon, authenticated;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kids_pin_set BOOLEAN NOT NULL DEFAULT false;

-- Kids mode can only be switched through set_kids_mode() (disabling needs the PIN).
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (
  display_name, avatar_url, language, daily_goal_minutes,
  streak_days, minutes_watched_today, total_minutes_watched, total_episodes_completed, updated_at
) ON public.profiles TO authenticated;

-- ====================================================================
-- HELPERS
-- ====================================================================

CREATE OR REPLACE FUNCTION public.has_active_vip(p_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = p_user
      AND tier = 'vip'
      AND status = 'active'
      AND (current_period_end IS NULL OR current_period_end > NOW())
  );
$$;

-- ====================================================================
-- CLIENT RPCs (authenticated users)
-- ====================================================================

-- Unlocks a paid episode with coins. Returns
--   {"status": "unlocked" | "already_accessible" | "insufficient_funds", "balance": int}
CREATE OR REPLACE FUNCTION public.unlock_episode(p_episode_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_episode public.episodes%ROWTYPE;
  v_balance INTEGER;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_episode FROM public.episodes WHERE id = p_episode_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'episode_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Lock the wallet row so concurrent unlocks cannot double-spend.
  SELECT balance INTO v_balance FROM public.coin_wallet WHERE user_id = v_user FOR UPDATE;
  v_balance := COALESCE(v_balance, 0);

  IF v_episode.is_free
     OR v_episode.coin_price = 0
     OR v_episode.format = 'summary'
     OR public.has_active_vip(v_user)
     OR EXISTS (SELECT 1 FROM public.unlocked_episodes WHERE user_id = v_user AND episode_id = p_episode_id)
  THEN
    RETURN jsonb_build_object('status', 'already_accessible', 'balance', v_balance);
  END IF;

  IF v_balance < v_episode.coin_price THEN
    RETURN jsonb_build_object('status', 'insufficient_funds', 'balance', v_balance);
  END IF;

  UPDATE public.coin_wallet
  SET balance = balance - v_episode.coin_price, updated_at = NOW()
  WHERE user_id = v_user
  RETURNING balance INTO v_balance;

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (v_user, 'spend', -v_episode.coin_price,
          format('Desbloqueo de "%s" (%s monedas)', v_episode.title, v_episode.coin_price));

  INSERT INTO public.unlocked_episodes (user_id, episode_id) VALUES (v_user, p_episode_id);

  RETURN jsonb_build_object('status', 'unlocked', 'balance', v_balance);
END;
$$;

-- Turns kids mode on/off. Enabling for the first time requires choosing a
-- 4-digit PIN; disabling requires the PIN. After 5 wrong PINs the account is
-- locked for 5 minutes. Returns {"ok": bool, "error"?: text, "kids_mode_enabled": bool}
CREATE OR REPLACE FUNCTION public.set_kids_mode(p_enabled BOOLEAN, p_pin TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_pin public.kids_pins%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_pin FROM public.kids_pins WHERE user_id = v_user FOR UPDATE;

  IF p_enabled THEN
    IF NOT FOUND THEN
      IF p_pin IS NULL OR p_pin !~ '^[0-9]{4}$' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'pin_required', 'kids_mode_enabled', false);
      END IF;
      INSERT INTO public.kids_pins (user_id, pin_hash)
      VALUES (v_user, extensions.crypt(p_pin, extensions.gen_salt('bf')));
    END IF;
    UPDATE public.profiles SET kids_mode_enabled = true, kids_pin_set = true, updated_at = NOW() WHERE id = v_user;
    RETURN jsonb_build_object('ok', true, 'kids_mode_enabled', true);
  END IF;

  -- Disabling
  IF NOT FOUND THEN
    UPDATE public.profiles SET kids_mode_enabled = false, updated_at = NOW() WHERE id = v_user;
    RETURN jsonb_build_object('ok', true, 'kids_mode_enabled', false);
  END IF;

  IF v_pin.locked_until IS NOT NULL AND v_pin.locked_until > NOW() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'locked', 'kids_mode_enabled', true);
  END IF;

  IF p_pin IS NULL OR v_pin.pin_hash <> extensions.crypt(p_pin, v_pin.pin_hash) THEN
    UPDATE public.kids_pins
    SET failed_attempts = failed_attempts + 1,
        locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN NOW() + INTERVAL '5 minutes' ELSE NULL END
    WHERE user_id = v_user;
    RETURN jsonb_build_object('ok', false, 'error', 'wrong_pin', 'kids_mode_enabled', true);
  END IF;

  UPDATE public.kids_pins SET failed_attempts = 0, locked_until = NULL WHERE user_id = v_user;
  UPDATE public.profiles SET kids_mode_enabled = false, updated_at = NOW() WHERE id = v_user;
  RETURN jsonb_build_object('ok', true, 'kids_mode_enabled', false);
END;
$$;

-- ====================================================================
-- SERVER RPCs (service role only, called from the Stripe webhook)
-- ====================================================================

-- Credits purchased coins exactly once per Stripe Checkout session.
-- Returns true when coins were credited, false if the session was already processed.
CREATE OR REPLACE FUNCTION public.credit_coin_purchase(
  p_user UUID, p_session_id TEXT, p_product TEXT, p_coins INTEGER, p_amount_cents INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.payments (user_id, stripe_session_id, product, coins, amount_cents)
  VALUES (p_user, p_session_id, p_product, p_coins, p_amount_cents)
  ON CONFLICT (stripe_session_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.coin_wallet (user_id, balance) VALUES (p_user, p_coins)
  ON CONFLICT (user_id) DO UPDATE SET balance = public.coin_wallet.balance + EXCLUDED.balance, updated_at = NOW();

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user, 'purchase', p_coins,
          format('Compra de %s monedas (%s €)', p_coins, replace(to_char(p_amount_cents / 100.0, 'FM999990.00'), '.', ',')));
  RETURN true;
END;
$$;

-- Mirrors a Stripe subscription into public.subscriptions.
CREATE OR REPLACE FUNCTION public.sync_vip_subscription(
  p_user UUID, p_active BOOLEAN, p_period_end TIMESTAMPTZ, p_customer_id TEXT, p_subscription_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, tier, status, current_period_end, stripe_customer_id, stripe_subscription_id)
  VALUES (p_user, CASE WHEN p_active THEN 'vip' ELSE 'free' END, CASE WHEN p_active THEN 'active' ELSE 'cancelled' END,
          p_period_end, p_customer_id, p_subscription_id)
  ON CONFLICT (user_id) DO UPDATE SET
    tier = EXCLUDED.tier,
    status = EXCLUDED.status,
    current_period_end = EXCLUDED.current_period_end,
    stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, public.subscriptions.stripe_customer_id),
    stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, public.subscriptions.stripe_subscription_id);
END;
$$;

-- Postgres grants EXECUTE to PUBLIC by default; lock every function down explicitly.
REVOKE EXECUTE ON FUNCTION public.has_active_vip(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.unlock_episode(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_kids_mode(BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.credit_coin_purchase(UUID, TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_vip_subscription(UUID, BOOLEAN, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.unlock_episode(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_kids_mode(BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.credit_coin_purchase(UUID, TEXT, TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_vip_subscription(UUID, BOOLEAN, TIMESTAMPTZ, TEXT, TEXT) TO service_role;
