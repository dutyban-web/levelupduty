-- ══════════════════════════════════════════════════════════════════════════════
--  중앙 캘린더 이벤트 테이블 (calendar_events)
--  모든 날짜 기반 데이터: 점괘, 저널, 여행, 퀘스트 등이 이 테이블에 저장됨
--  각 메뉴(Fortune, Journal 등)는 event_type으로 필터링하여 '뷰'로만 사용
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date TEXT NOT NULL,  -- YYYY-MM-DD
  event_type TEXT NOT NULL,  -- 'fortune' | 'journal' | 'quest' | 'travel' | 'event'
  title TEXT NOT NULL DEFAULT '',
  content JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE calendar_events DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(event_type);
CREATE INDEX IF NOT EXISTS idx_calendar_events_created ON calendar_events(created_at DESC);
