-- daily_logs에 fortune_feedback 컬럼 추가 (운세 피드백 노트)
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS fortune_feedback TEXT;
