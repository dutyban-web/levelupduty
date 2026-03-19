-- reading_logs에 notes(나의 해석/코멘트) 컬럼 추가
ALTER TABLE reading_logs ADD COLUMN IF NOT EXISTS notes TEXT;
