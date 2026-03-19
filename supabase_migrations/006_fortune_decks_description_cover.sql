-- fortune_decks에 description, cover_image_url 컬럼 추가
ALTER TABLE fortune_decks ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE fortune_decks ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
