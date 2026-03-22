-- ══════════════════════════════════════════════════════════════════════════════
--  manual_documents.category — 문서 카테고리 (사용자가 점진적으로 확장)
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE manual_documents
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';
