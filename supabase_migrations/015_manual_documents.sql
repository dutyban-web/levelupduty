-- ══════════════════════════════════════════════════════════════════════════════
--  manual_documents — 통합 매뉴얼·체크리스트·문서 (BlockNote JSON + 첨부 메타 JSONB)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS manual_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT '제목 없음',
  sort_order  INT NOT NULL DEFAULT 0,
  blocks      JSONB NOT NULL DEFAULT '[]'::jsonb,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manual_documents_user_id ON manual_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_manual_documents_user_sort ON manual_documents(user_id, sort_order);

ALTER TABLE manual_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manual_documents_select_own" ON manual_documents;
DROP POLICY IF EXISTS "manual_documents_insert_own" ON manual_documents;
DROP POLICY IF EXISTS "manual_documents_update_own" ON manual_documents;
DROP POLICY IF EXISTS "manual_documents_delete_own" ON manual_documents;

CREATE POLICY "manual_documents_select_own" ON manual_documents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "manual_documents_insert_own" ON manual_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "manual_documents_update_own" ON manual_documents
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "manual_documents_delete_own" ON manual_documents
  FOR DELETE USING (auth.uid() = user_id);
