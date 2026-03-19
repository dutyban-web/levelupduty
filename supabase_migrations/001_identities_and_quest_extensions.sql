-- Identity (정체성) 테이블
CREATE TABLE IF NOT EXISTS identities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  role_model    TEXT,
  time_spent_sec INTEGER NOT NULL DEFAULT 0,
  xp            INTEGER NOT NULL DEFAULT 0,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE identities DISABLE ROW LEVEL SECURITY;

-- quests에 identity_id, status, tags, sort_order 추가
ALTER TABLE quests ADD COLUMN IF NOT EXISTS identity_id UUID;
ALTER TABLE quests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'someday';  -- someday | not_started | in_progress | done
ALTER TABLE quests ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]';       -- ["공모전","마감직전"]
ALTER TABLE quests ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- areas, projects에 sort_order 추가
ALTER TABLE areas ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
