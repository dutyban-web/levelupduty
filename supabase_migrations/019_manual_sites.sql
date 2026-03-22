-- ══════════════════════════════════════════════════════════════════════════════
--  manual_sites — Manual 영역 링크·북마크 (SNS, 유튜브, 사이트 등)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS manual_sites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT '',
  url         TEXT NOT NULL DEFAULT '',
  note        TEXT,
  category    TEXT NOT NULL DEFAULT '',
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manual_sites_user_id ON manual_sites(user_id);
CREATE INDEX IF NOT EXISTS idx_manual_sites_user_sort ON manual_sites(user_id, sort_order);

ALTER TABLE manual_sites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manual_sites_select_own" ON manual_sites;
DROP POLICY IF EXISTS "manual_sites_insert_own" ON manual_sites;
DROP POLICY IF EXISTS "manual_sites_update_own" ON manual_sites;
DROP POLICY IF EXISTS "manual_sites_delete_own" ON manual_sites;

CREATE POLICY "manual_sites_select_own" ON manual_sites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "manual_sites_insert_own" ON manual_sites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "manual_sites_update_own" ON manual_sites
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "manual_sites_delete_own" ON manual_sites
  FOR DELETE USING (auth.uid() = user_id);
