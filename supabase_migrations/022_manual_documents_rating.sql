-- ══════════════════════════════════════════════════════════════════════════════
--  manual_documents.rating — 통합 레이팅과 동일 스케일 (0=미설정, 0.5~5, 0.5 단위)
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE manual_documents
  ADD COLUMN IF NOT EXISTS rating REAL NOT NULL DEFAULT 0;

ALTER TABLE manual_documents
  DROP CONSTRAINT IF EXISTS manual_documents_rating_check;

ALTER TABLE manual_documents
  ADD CONSTRAINT manual_documents_rating_check
  CHECK (rating >= 0 AND rating <= 5);

COMMENT ON COLUMN manual_documents.rating IS '통합 레이팅과 동일: 0=미설정, 0.5 단위 최대 5';
