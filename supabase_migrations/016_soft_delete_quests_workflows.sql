-- 소프트 삭제: Quest(메인 보드)·Workflow(Value 순서도)
-- 앱의 softDeleteUserQuestRow / softDeleteWorkflow 가 사용합니다.

ALTER TABLE quests ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_quests_is_deleted ON quests(is_deleted) WHERE is_deleted = TRUE;

ALTER TABLE workflows ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_workflows_is_deleted ON workflows(is_deleted) WHERE is_deleted = TRUE;
