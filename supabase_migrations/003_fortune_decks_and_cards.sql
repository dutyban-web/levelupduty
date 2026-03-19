-- Fortune 타로 덱 및 카드 테이블
CREATE TABLE IF NOT EXISTS fortune_decks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE fortune_decks DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS fortune_cards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id       UUID NOT NULL REFERENCES fortune_decks(id) ON DELETE CASCADE,
  name_ko       TEXT NOT NULL,
  name_en       TEXT,
  emoji         TEXT,
  meaning       TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE fortune_cards DISABLE ROW LEVEL SECURITY;

-- 기본 타로 덱 + 22장 메이저 아르카나 시드
INSERT INTO fortune_decks (id, name, sort_order) VALUES
  ('a0000000-0000-0000-0000-000000000001'::uuid, '기본 타로 카드', 0)
ON CONFLICT DO NOTHING;

INSERT INTO fortune_cards (deck_id, name_ko, name_en, emoji, meaning, sort_order) 
SELECT 'a0000000-0000-0000-0000-000000000001'::uuid, v.name_ko, v.name_en, v.emoji, v.meaning, v.idx
FROM (VALUES
  (0, '바보','The Fool','🃏','새로운 시작, 순수함, 자유'),
  (1, '마법사','The Magician','✨','의지, 창의력, 가능성'),
  (2, '여사제','The High Priestess','🌙','직관, 비밀, 내면의 지혜'),
  (3, '여황제','The Empress','👑','풍요, 창조, 모성'),
  (4, '황제','The Emperor','⚜️','질서, 권위, 구조'),
  (5, '교황','The Hierophant','📿','전통, 가르침, 영성'),
  (6, '연인','The Lovers','💕','선택, 사랑, 조화'),
  (7, '전차','The Chariot','🏹','의지력, 승리, 전진'),
  (8, '힘','Strength','🦁','용기, 인내, 부드러운 힘'),
  (9, '은둔자','The Hermit','🕯️','성찰, 고독, 내면 탐구'),
  (10,'운명의 수레바퀴','Wheel of Fortune','☸️','변화, 순환, 운명'),
  (11,'정의','Justice','⚖️','공정함, 균형, 진실'),
  (12,'매달린 사람','The Hanged Man','🙃','전환, 포기, 새로운 시각'),
  (13,'사신','Death','🦋','끝과 시작, 변신, 재탄생'),
  (14,'절제','Temperance','🕊️','조화, 인내, 중용'),
  (15,'악마','The Devil','🔗','속박, 유혹, 해방'),
  (16,'탑','The Tower','⚡','붕괴, 계시, 재건'),
  (17,'별','The Star','⭐','희망, 치유, 영감'),
  (18,'달','The Moon','🌜','직관, 꿈, 무의식'),
  (19,'태양','The Sun','☀️','기쁨, 성공, 활력'),
  (20,'심판','Judgement','📯','재탄생, 용서, 소명'),
  (21,'세계','The World','🌍','완성, 성취, 통합')
) AS v(idx, name_ko, name_en, emoji, meaning)
WHERE NOT EXISTS (SELECT 1 FROM fortune_cards WHERE deck_id = 'a0000000-0000-0000-0000-000000000001' LIMIT 1);
