-- ══════════════════════════════════════════════════════════════════════════════
--  manual_keys — Manual 영역 키·시리얼·가입 정보 시트 (RLS: 본인만)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS manual_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  category    TEXT NOT NULL DEFAULT '',
  name        TEXT NOT NULL DEFAULT '',
  key_text    TEXT NOT NULL DEFAULT '',
  note        TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manual_keys_user_id ON manual_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_manual_keys_user_sort ON manual_keys(user_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_manual_keys_user_date ON manual_keys(user_id, entry_date DESC);

ALTER TABLE manual_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manual_keys_select_own" ON manual_keys;
DROP POLICY IF EXISTS "manual_keys_insert_own" ON manual_keys;
DROP POLICY IF EXISTS "manual_keys_update_own" ON manual_keys;
DROP POLICY IF EXISTS "manual_keys_delete_own" ON manual_keys;

CREATE POLICY "manual_keys_select_own" ON manual_keys
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "manual_keys_insert_own" ON manual_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "manual_keys_update_own" ON manual_keys
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "manual_keys_delete_own" ON manual_keys
  FOR DELETE USING (auth.uid() = user_id);
