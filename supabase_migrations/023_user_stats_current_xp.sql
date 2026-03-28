-- user_stats: 앱이 기대하는 current_xp 컬럼 (누락 시 Supabase SQL Editor에서 실행)
ALTER TABLE public.user_stats
  ADD COLUMN IF NOT EXISTS current_xp INTEGER NOT NULL DEFAULT 0;
