-- ═══════════════════════════════════════════════════════════════════════════
-- Manifestation (인과율) — causes / effects / cause_effect_links
-- Supabase SQL Editor에서 한 번 실행하세요. RLS: 본인 user_id 행만 접근.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS causes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT '✨',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS effects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT '✨',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cause_effect_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  cause_id UUID NOT NULL REFERENCES causes (id) ON DELETE CASCADE,
  effect_id UUID NOT NULL REFERENCES effects (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (cause_id, effect_id)
);

CREATE INDEX IF NOT EXISTS idx_cel_user_cause ON cause_effect_links (user_id, cause_id);
CREATE INDEX IF NOT EXISTS idx_cel_user_effect ON cause_effect_links (user_id, effect_id);

ALTER TABLE causes ENABLE ROW LEVEL SECURITY;
ALTER TABLE effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE cause_effect_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "causes_own" ON causes;
DROP POLICY IF EXISTS "effects_own" ON effects;
DROP POLICY IF EXISTS "cel_own" ON cause_effect_links;

CREATE POLICY "causes_own" ON causes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "effects_own" ON effects FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cel_own" ON cause_effect_links FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
