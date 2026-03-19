-- drawn_cards JSONB 컬럼 추가 (다중 카드 배열)
ALTER TABLE reading_logs ADD COLUMN IF NOT EXISTS drawn_cards JSONB DEFAULT '[]'::jsonb;

-- 기존 단일 카드 컬럼 nullable로 변경 (drawn_cards 사용)
ALTER TABLE reading_logs ALTER COLUMN card_emoji DROP NOT NULL;
ALTER TABLE reading_logs ALTER COLUMN card_name_ko DROP NOT NULL;

-- 기존 데이터 마이그레이션: card_emoji, card_name_ko, card_name_en → drawn_cards
UPDATE reading_logs
SET drawn_cards = jsonb_build_array(
  jsonb_build_object(
    'emoji', COALESCE(card_emoji, '🃏'),
    'name_ko', COALESCE(card_name_ko, ''),
    'name_en', COALESCE(card_name_en, '')
  )
)
WHERE COALESCE(drawn_cards, '[]'::jsonb) = '[]'::jsonb
  AND (COALESCE(card_emoji, '') != '' OR COALESCE(card_name_ko, '') != '');
