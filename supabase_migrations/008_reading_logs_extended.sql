-- reading_logs 확장: 점괘 종류, 점수, 운세 좋음/나쁨, 적중도, 관련 인물
ALTER TABLE reading_logs ADD COLUMN IF NOT EXISTS fortune_type TEXT;
ALTER TABLE reading_logs ADD COLUMN IF NOT EXISTS fortune_score INTEGER;  -- 1~100 점괘 점수 (좋은지 나쁜지)
ALTER TABLE reading_logs ADD COLUMN IF NOT EXISTS fortune_outcome TEXT; -- 'good' | 'bad' | null
ALTER TABLE reading_logs ADD COLUMN IF NOT EXISTS accuracy_score INTEGER; -- 1~100 실제로 맞았는지
ALTER TABLE reading_logs ADD COLUMN IF NOT EXISTS related_people TEXT;    -- 관련 인물 (쉼표 구분 가능)
