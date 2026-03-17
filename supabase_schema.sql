-- ══════════════════════════════════════════════════════════════
--  창작 OS — Supabase SQL 스키마 v2
--  Supabase Dashboard > SQL Editor 에서 전체 복사 후 실행
-- ══════════════════════════════════════════════════════════════

-- ── 1. user_stats (레벨 · 경험치 · 스탯 — id=1 단일 행) ─────────────
CREATE TABLE IF NOT EXISTS user_stats (
  id           INTEGER     PRIMARY KEY DEFAULT 1,
  level        INTEGER     NOT NULL DEFAULT 1,
  current_xp   INTEGER     NOT NULL DEFAULT 0,
  required_xp  INTEGER     NOT NULL DEFAULT 100,
  stats_json   JSONB       NOT NULL DEFAULT '{}',
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 행 삽입 (앱 첫 실행 시 자동 존재하도록)
INSERT INTO user_stats (id, level, current_xp, required_xp, stats_json)
VALUES (1, 1, 0, 100, '{}')
ON CONFLICT DO NOTHING;

ALTER TABLE user_stats DISABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE user_stats;

-- ── 2. quests (퀘스트 완료 여부) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS quests (
  quest_id     TEXT        PRIMARY KEY,
  completed    BOOLEAN     NOT NULL DEFAULT FALSE,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quests DISABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE quests;

-- ── 3. journals (날짜별 일지) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journals (
  date         TEXT        PRIMARY KEY,   -- YYYY-MM-DD
  content      TEXT        NOT NULL DEFAULT '',
  blocks       JSONB       NOT NULL DEFAULT '[]',
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE journals DISABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE journals;

-- ── 4. app_kv (기타 데이터 — worlds · saju · calendar · travel · gourmet) ──
CREATE TABLE IF NOT EXISTS app_kv (
  key          TEXT        PRIMARY KEY,
  value        JSONB       NOT NULL,
  synced_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_kv DISABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE app_kv;

-- ══════════════════════════════════════════════════════════════
--  저장 위치 요약
--  user_stats (id=1)  → 레벨, 경험치, 스탯 카드 값
--  quests             → 퀘스트별 완료 여부
--  journals           → 날짜별 일지 텍스트 + 성과 블록
--  app_kv             → worlds / saju / calendar / travel / gourmet
-- ══════════════════════════════════════════════════════════════
