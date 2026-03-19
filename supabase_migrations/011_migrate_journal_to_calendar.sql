-- ══════════════════════════════════════════════════════════════════════════════
--  journals → calendar_events 마이그레이션 (저널 기록)
--  실행 조건: journals 테이블에 record_date, title, content, group_name, sub_name 컬럼 존재
-- ══════════════════════════════════════════════════════════════════════════════

-- journals 테이블에서 calendar_events로 복사 (record_date 등 컬럼이 있는 경우)
INSERT INTO calendar_events (event_date, event_type, title, content, created_at, updated_at)
SELECT
  j.record_date::text,
  'journal',
  COALESCE(NULLIF(TRIM(j.title), ''), '[저널]'),
  jsonb_build_object(
    'content', COALESCE(j.content, ''),
    'group_name', COALESCE(j.group_name, ''),
    'sub_name', COALESCE(j.sub_name, '')
  ),
  COALESCE(j.created_at, NOW()),
  NOW()
FROM journals j
WHERE j.record_date IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM calendar_events ce
    WHERE ce.event_type = 'journal'
      AND ce.event_date = j.record_date::text
      AND ce.title = COALESCE(NULLIF(TRIM(j.title), ''), '[저널]')
  );
