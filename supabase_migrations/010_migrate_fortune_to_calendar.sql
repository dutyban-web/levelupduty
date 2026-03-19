-- ══════════════════════════════════════════════════════════════════════════════
--  reading_logs → calendar_events 마이그레이션 (점괘 기록)
--  실행 순서: 009_calendar_events.sql 먼저 실행 후 본 파일 실행

-- 1. reading_logs 데이터를 calendar_events로 복사
--    (fortune_type 등 확장 컬럼은 008 마이그레이션 후 있으면 포함, 없으면 null)
INSERT INTO calendar_events (id, event_date, event_type, title, content, created_at, updated_at)
SELECT
  r.id,
  to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
  'fortune',
  COALESCE(NULLIF(TRIM(r.question), ''), '[점괘 기록]'),
  jsonb_build_object(
    'source', 'reading',
    'question', COALESCE(r.question, ''),
    'drawn_cards', COALESCE(r.drawn_cards, '[]'::jsonb),
    'notes', r.notes,
    'fortune_type', NULL,
    'fortune_score', NULL,
    'fortune_outcome', NULL,
    'accuracy_score', NULL,
    'related_people', NULL
  ),
  r.created_at,
  NOW()
FROM reading_logs r
WHERE NOT EXISTS (SELECT 1 FROM calendar_events ce WHERE ce.id = r.id);

-- 2. daily_logs fortune_feedback → calendar_events (운세 피드백)
INSERT INTO calendar_events (event_date, event_type, title, content, created_at, updated_at)
SELECT
  d.log_date,
  'fortune',
  '운세 피드백',
  jsonb_build_object(
    'source', 'feedback',
    'fortune_feedback', d.fortune_feedback
  ),
  (d.log_date || 'T12:00:00Z')::timestamptz,
  NOW()
FROM daily_logs d
WHERE d.fortune_feedback IS NOT NULL AND TRIM(d.fortune_feedback) != ''
  AND NOT EXISTS (
    SELECT 1 FROM calendar_events ce
    WHERE ce.event_date = d.log_date AND ce.event_type = 'fortune'
      AND ce.content->>'source' = 'feedback'
  );
