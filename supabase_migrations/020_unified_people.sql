-- ══════════════════════════════════════════════════════════════════════════════
--  unified_people + person_entity_links — 통합 인물 DB (매뉴얼·Life·목표·점괘 등 연결)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS unified_people (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  sort_order  INT NOT NULL DEFAULT 0,
  note        TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unified_people_user_id ON unified_people(user_id);
CREATE INDEX IF NOT EXISTS idx_unified_people_user_sort ON unified_people(user_id, sort_order);

ALTER TABLE unified_people ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unified_people_select_own" ON unified_people;
DROP POLICY IF EXISTS "unified_people_insert_own" ON unified_people;
DROP POLICY IF EXISTS "unified_people_update_own" ON unified_people;
DROP POLICY IF EXISTS "unified_people_delete_own" ON unified_people;

CREATE POLICY "unified_people_select_own" ON unified_people
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "unified_people_insert_own" ON unified_people
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "unified_people_update_own" ON unified_people
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "unified_people_delete_own" ON unified_people
  FOR DELETE USING (auth.uid() = user_id);

-- entity_type + entity_id: 예) manual_document / <uuid>, reading_log / <uuid>, goals_kv / main
CREATE TABLE IF NOT EXISTS person_entity_links (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id    UUID NOT NULL REFERENCES unified_people(id) ON DELETE CASCADE,
  entity_type  TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  role         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT person_entity_links_unique UNIQUE (user_id, person_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_person_entity_links_entity ON person_entity_links (user_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_person_entity_links_person ON person_entity_links (user_id, person_id);

ALTER TABLE person_entity_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "person_entity_links_select_own" ON person_entity_links;
DROP POLICY IF EXISTS "person_entity_links_insert_own" ON person_entity_links;
DROP POLICY IF EXISTS "person_entity_links_update_own" ON person_entity_links;
DROP POLICY IF EXISTS "person_entity_links_delete_own" ON person_entity_links;

CREATE POLICY "person_entity_links_select_own" ON person_entity_links
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "person_entity_links_insert_own" ON person_entity_links
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "person_entity_links_update_own" ON person_entity_links
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "person_entity_links_delete_own" ON person_entity_links
  FOR DELETE USING (auth.uid() = user_id);
