-- ══════════════════════════════════════════════════════════════════════════════
--  manual_documents — 책 표지 색(hue) + 우측 메모(notes)
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE manual_documents
  ADD COLUMN IF NOT EXISTS cover_hue INT;

ALTER TABLE manual_documents
  ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';

ALTER TABLE manual_documents
  DROP CONSTRAINT IF EXISTS manual_documents_cover_hue_check;

ALTER TABLE manual_documents
  ADD CONSTRAINT manual_documents_cover_hue_check
  CHECK (cover_hue IS NULL OR (cover_hue >= 0 AND cover_hue <= 360));
