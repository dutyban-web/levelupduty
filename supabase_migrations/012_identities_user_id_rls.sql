-- ══════════════════════════════════════════════════════════════════════════════
--  identities: user_id 추가 + RLS (로그인 사용자 본인 데이터만 CRUD)
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. user_id 컬럼 추가 (auth.users.id 참조)
ALTER TABLE identities ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. 기존 데이터: user_id가 NULL인 행은 첫 번째 사용자에게 할당 (단일 사용자 환경 가정)
--    다중 사용자 환경이면 수동으로 user_id를 설정해야 함
DO $$
DECLARE
  first_user_id UUID;
BEGIN
  SELECT id INTO first_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
  IF first_user_id IS NOT NULL THEN
    UPDATE identities SET user_id = first_user_id WHERE user_id IS NULL;
  END IF;
END $$;

-- 3. 새 행은 user_id 필수 (기존 데이터가 모두 할당된 경우에만 NOT NULL 적용)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM identities WHERE user_id IS NULL) THEN
    ALTER TABLE identities ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

-- 4. RLS 활성화 (기존 DISABLE 제거)
ALTER TABLE identities ENABLE ROW LEVEL SECURITY;

-- 5. 기존 정책 제거 (있다면)
DROP POLICY IF EXISTS "identities_select_own" ON identities;
DROP POLICY IF EXISTS "identities_insert_own" ON identities;
DROP POLICY IF EXISTS "identities_update_own" ON identities;
DROP POLICY IF EXISTS "identities_delete_own" ON identities;

-- 6. RLS 정책: 로그인한 사용자만 본인(user_id = auth.uid()) 데이터 CRUD
CREATE POLICY "identities_select_own" ON identities
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "identities_insert_own" ON identities
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "identities_update_own" ON identities
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "identities_delete_own" ON identities
  FOR DELETE USING (auth.uid() = user_id);

-- 7. 인덱스 (user_id로 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_identities_user_id ON identities(user_id);
