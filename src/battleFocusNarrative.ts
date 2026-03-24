/**
 * BattleFocus — 가치·장기 목표에 연결된 브리핑 서사
 */
import type { ValueAction } from './valueActionData'

export type NarrativeTheme =
  | 'family'
  | 'creative'
  | 'career_japan'
  | 'career_global'
  | 'health'
  | 'finance'
  | 'learning'
  | 'generic'

const FAMILY_KW = /가족|아내|남편|배우자|부부|육아|자녀|아이|부모|결혼|가정|소중한\s*사람|배려|가족운명/i
const CREATIVE_KW = /원고|집필|창작|소설|글쓰기|시나리오|만화|웹툰|투고|원고지|탈고|히트|베스트셀러|유작|작가|글\s|원고\s/i
const JP_KW = /일본|도쿄|오사카|교토|후쿠오카|N1|N2|JLPT|일본어|진출|해외\s*진출|현지|유학/i
const GLOBAL_KW = /미국|유럽|글로벌|세계|해외|영어|현지|수출|IPO/i
const HEALTH_KW = /건강|운동|수면|다이어트|병원|명상|회복|체력/i
const FINANCE_KW = /재테크|투자|저축|연금|재무|수익|매출|계약금/i
const LEARN_KW = /학습|자격|시험|공부|강의|책\s|독서|언어|스킬/i

function norm(s: string) {
  return s.trim().toLowerCase()
}

/** 퀘스트·영역·가치 링크로 서사 테마 판별 */
export function detectNarrativeTheme(input: {
  questName: string
  tags?: string[]
  areaName?: string | null
  projectName?: string | null
  valueAction?: ValueAction | null
}): NarrativeTheme {
  const blob = [
    input.questName,
    ...(input.tags ?? []),
    input.areaName ?? '',
    input.projectName ?? '',
    input.valueAction?.actionName ?? '',
    input.valueAction?.identity ?? '',
  ]
    .join(' ')
    .trim()

  const v = valueActionThemeHint(input.valueAction)
  if (v) return v

  if (FAMILY_KW.test(blob)) return 'family'
  if (CREATIVE_KW.test(blob)) return 'creative'
  if (JP_KW.test(blob)) return 'career_japan'
  if (GLOBAL_KW.test(blob)) return 'career_global'
  if (HEALTH_KW.test(blob)) return 'health'
  if (FINANCE_KW.test(blob)) return 'finance'
  if (LEARN_KW.test(blob)) return 'learning'
  return 'generic'
}

function valueActionThemeHint(va: ValueAction | null | undefined): NarrativeTheme | null {
  if (!va) return null
  const t = `${va.identity} ${va.actionName}`
  if (FAMILY_KW.test(t)) return 'family'
  if (CREATIVE_KW.test(t)) return 'creative'
  if (JP_KW.test(t)) return 'career_japan'
  if (GLOBAL_KW.test(t)) return 'career_global'
  if (HEALTH_KW.test(t)) return 'health'
  if (FINANCE_KW.test(t)) return 'finance'
  if (LEARN_KW.test(t)) return 'learning'
  return null
}

/** 브리핑 한 줄 (비극 시뮬레이션) */
export function buildTragicBriefingLine(
  theme: NarrativeTheme,
  questName: string,
  valueLabel: string,
): string {
  const v = valueLabel.trim() || '당신이 지키려는 가치'
  const q = questName.trim() || '이 과제'

  switch (theme) {
    case 'family':
      return `이 일을 완료하지 않으면 운명의 실이 엉켜 ${v}와(과) 맺은 소중한 시간이 오염됩니다.`
    case 'creative':
      return `「${q}」가 미완으로 끝나면 2029년의 당신은 '후회'라는 유작만을 남기게 됩니다.`
    case 'career_japan':
      return `지금 멈추면 ${v}를 향한 일본 루트의 서류는 찢기고, 도착했어야 할 미래의 편지는 발송되지 않습니다.`
    case 'career_global':
      return `이 분기를 건너뛰면 세계 지도 위에 그려둔 ${v}의 핀은 떨어지고, 확률은 영점으로 수렴합니다.`
    case 'health':
      return `집중을 거두면 몸의 계기판이 거짓말을 멈추고, ${v}로 가는 회복 곡선이 꺾입니다.`
    case 'finance':
      return `「${q}」를 외면하면 ${v}와 연결된 자금의 흐름이 정체되고, 숫자는 당신을 믿지 않게 됩니다.`
    case 'learning':
      return `이 세션을 포기하면 ${v}를 증명할 자격의 타임라인이 한 칸 밀리고, 시험대는 차갑게 식습니다.`
    default:
      return `「${q}」를 외면하면, 뻗어 나가야 할 운명선이 한 줄씩 끊깁니다. (${v})`
  }
}

/** App ↔ BattleFocus 전리품 비동기 로딩 */
export type FocusLootState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; xpGain: number; coins: number; identityName: string; message: string; error?: string }

/** 전리품 팝업 격려 문구 (템플릿) */
export function buildLootEncouragement(identityName: string, xpGain: number): string {
  const name = identityName.trim() || '선택한 태세'
  if (xpGain <= 0) {
    return '기록은 남았습니다. 다음 전장에서 다시 불꽃을 피워 올리세요.'
  }
  return `훌륭한 전투였습니다! ${name} 태세의 레벨이 오르고 있습니다. (+${xpGain} XP)`
}
