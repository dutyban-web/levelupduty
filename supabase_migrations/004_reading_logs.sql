-- 점괘 기록 (Reading Logs) 테이블
CREATE TABLE IF NOT EXISTS reading_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question   TEXT NOT NULL DEFAULT '',
  card_emoji TEXT NOT NULL DEFAULT '🃏',
  card_name_ko TEXT NOT NULL DEFAULT '',
  card_name_en TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE reading_logs DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_reading_logs_created_at ON reading_logs(created_at DESC);
