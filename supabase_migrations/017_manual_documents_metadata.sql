-- ══════════════════════════════════════════════════════════════════════════════
--  manual_documents — 태그, 중요도, 완성율, 마지막 열람 (필터·정렬용)
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE manual_documents
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE manual_documents
  ADD COLUMN IF NOT EXISTS importance_score INT NOT NULL DEFAULT 0;

ALTER TABLE manual_documents
  ADD COLUMN IF NOT EXISTS completion_rate NUMERIC(5, 2) NOT NULL DEFAULT 0;

ALTER TABLE manual_documents
  ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ;

ALTER TABLE manual_documents
  DROP CONSTRAINT IF EXISTS manual_documents_importance_score_check;

ALTER TABLE manual_documents
  ADD CONSTRAINT manual_documents_importance_score_check
  CHECK (importance_score >= 0 AND importance_score <= 100);

ALTER TABLE manual_documents
  DROP CONSTRAINT IF EXISTS manual_documents_completion_rate_check;

ALTER TABLE manual_documents
  ADD CONSTRAINT manual_documents_completion_rate_check
  CHECK (completion_rate >= 0 AND completion_rate <= 100);
