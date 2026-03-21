-- ══════════════════════════════════════════════════════════════════════════════
--  workflows — Value 메뉴 작업 순서도 (React Flow 노드/연결 JSONB 저장)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS workflows (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT '',
  description   TEXT DEFAULT '',
  nodes         JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges         JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON workflows(created_at DESC);

ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workflows_select_own" ON workflows;
DROP POLICY IF EXISTS "workflows_insert_own" ON workflows;
DROP POLICY IF EXISTS "workflows_update_own" ON workflows;
DROP POLICY IF EXISTS "workflows_delete_own" ON workflows;

CREATE POLICY "workflows_select_own" ON workflows
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "workflows_insert_own" ON workflows
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "workflows_update_own" ON workflows
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "workflows_delete_own" ON workflows
  FOR DELETE USING (auth.uid() = user_id);
