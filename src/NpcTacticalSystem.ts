/**
 * 실시간 조력자(NPC) 전술 브리핑 — 뇌과학 기반 8가지 전술 카드
 * 트리거: MP, 집중 경과 시간, 정체성 불일치, 보스 HP, 초과 집중 등
 */
import type { CompanionTraitId } from './lifeWorldData'

export type TacticalVoice = 'analyst' | 'creator' | 'capitalist' | 'adventurer'

export type TacticalId =
  | 'physiological_sigh'
  | 'panoramic_vision'
  | 'ultradian_bridge'
  | 'cognitive_reframe'
  | 'identity_alignment'
  | 'prefrontal_overdrive'
  | 'reward_horizon'
  | 'optic_micro_reset'

export type NpcTacticDef = {
  id: TacticalId
  /** 낮을수록 먼저 평가 (내부에서 우선순위 숫자로 변환) */
  priority: number
  /** 최소 재발화 간격 (같은 전술, ms) */
  cooldownMs: number
  title: string
  /** 트리거 만족 여부 */
  when: (ctx: TacticalEvalContext) => boolean
  /** voice별 본문 (조력자 성향) */
  lines: Record<TacticalVoice, string>
}

export type TacticalEvalContext = {
  mpRatio: number
  /** 전투 세션 중 누적 초 (일시정지 시 정지) */
  sessionElapsedSec: number
  isOvertime: boolean
  /** 연결 가치 행동의 정체성 vs 현재 태세 이름 불일치 */
  identityMismatch: boolean
  /** 보스 HP % (남은 양) */
  bossHpPct: number
}

const MIN_ANY_MS = 42_000

export const NPC_TACTICS: NpcTacticDef[] = [
  {
    id: 'physiological_sigh',
    priority: 100,
    cooldownMs: 180_000,
    title: '생리적 한숨',
    when: ctx => ctx.mpRatio < 0.2,
    lines: {
      analyst:
        '교감신경 과가동입니다. 이중 들이마시고, 길게 내쉬세요. 프론탈에 산소를 돌려보냅니다.',
      creator:
        '지금은 문장이 아니라 호흡입니다. 짧게 두 번 들이쉬고, 한 번에 천천히 내뱉으세요. 리듬이 돌아옵니다.',
      capitalist:
        'ROI 관점: 90초 호흡이 다음 의사결정 오류 비용을 줄입니다. 이중 흡기 → 긴 호기.',
      adventurer:
        '보스가 아니라 신경계예요. 두 번 들이쉬고, 천천히 내쉬며 전장을 가라앉히세요.',
    },
  },
  {
    id: 'panoramic_vision',
    priority: 72,
    cooldownMs: 360_000,
    title: '파노라마 시야',
    when: ctx => ctx.sessionElapsedSec >= 50 * 60,
    lines: {
      analyst:
        '장시간 좁은 시야입니다. 시선을 멀리 두고, 망막 주변이 아닌 전체 광장을 수집하세요 (optic flow).',
      creator:
        '캔버스에 너무 가까이 붙었습니다. 고개를 들어 방·창·수평선을 한 번에 담으세요. 장면이 숨 쉽니다.',
      capitalist:
        '미시에 매몰됐습니다. 10초간 주변 시야를 넓게 스캔해 리스크 맵을 다시 그리세요.',
      adventurer:
        '50분, 좁은 던전이었습니다. 시야를 넓혀 지형 전체를 — 다음 발판을 다시 봅니다.',
    },
  },
  {
    id: 'ultradian_bridge',
    priority: 58,
    cooldownMs: 240_000,
    title: '울트라디안 브리지',
    when: ctx => {
      const sec = ctx.sessionElapsedSec
      if (sec < 45 * 60) return false
      return sec % (45 * 60) < 18
    },
    lines: {
      analyst:
        '약 90분 울트라디안 주기 근처입니다. 5분만이라도 산책·스트레칭으로 뇌파를 리셋하세요.',
      creator:
        '한 막이 끝났습니다. 물 한 모금, 어깨, 창밖 — 다음 장면은 리셋 뒤에 씁니다.',
      capitalist:
        '집중 자산의 수익률이 하락 구간일 수 있습니다. 짧은 물리적 리셋이 기회비용을 줄입니다.',
      adventurer:
        '45분 루프입니다. 캠프 파이어 한 번 — 체력 바를 현실에서도 채우세요.',
    },
  },
  {
    id: 'cognitive_reframe',
    priority: 62,
    cooldownMs: 200_000,
    when: ctx => ctx.mpRatio >= 0.2 && ctx.mpRatio < 0.35,
    lines: {
      analyst:
        'MP가 경고선입니다. 위협 서술을 데이터 서술로 바꿔 보세요. “망했다” → “지연 변수가 생겼다”.',
      creator:
        '지금 감정은 한 장면일 뿐입니다. 다음 컷으로 넘길 수 있는지 한 줄만 적어 보세요.',
      capitalist:
        '손실 회피 편향이 올 수 있습니다. 최악·최선·현실적 세 시나리오만 적고 선택하세요.',
      adventurer:
        '체력은 낮지만 아직 패배 화면은 아닙니다. 한 가지 작은 반격만 고르세요.',
    },
  },
  {
    id: 'identity_alignment',
    priority: 85,
    cooldownMs: 300_000,
    title: '정체성 정렬',
    when: ctx => ctx.identityMismatch,
    lines: {
      analyst:
        '이 과제의 서명 정체성과 지금 태세가 어긋납니다. 의도적 전환인지, 확인이 필요합니다.',
      creator:
        '지금 붙잡은 퀘스트와 당신의 목소리가 다른 각본을 쓰고 있어요. 태세를 바꾸거나 과제를 바꾸세요.',
      capitalist:
        '포트폴리오 정렬 알림: 이 일이 현재 브랜드(태세)와 맞는지 30초만 점검하세요.',
      adventurer:
        '길이 갈라졌습니다. 이 전장이 지금의 당신 소속인지, 아니면 다른 깃발을 꽂아야 하는지.',
    },
  },
  {
    id: 'prefrontal_overdrive',
    priority: 78,
    cooldownMs: 220_000,
    title: '전전두 초과',
    when: ctx => ctx.isOvertime,
    lines: {
      analyst:
        '초과 집중 구간 — 전전두 피로가 큽니다. 목표만 한 줄로 줄이고, 산출물 하나만 남기세요.',
      creator:
        '연장전입니다. 한 장면만 더 — 나머지는 다음 화로 미루는 것도 연출입니다.',
      capitalist:
        '초과 근무는 한계 비용이 급상승합니다. 지금 끝낼 한 가지와 미룰 한 가지를 나누세요.',
      adventurer:
        '오버타임 던전입니다. 보스 한 방만 — 욕심은 다음 레이드로 넘기세요.',
    },
  },
  {
    id: 'reward_horizon',
    priority: 52,
    cooldownMs: 200_000,
    title: '보상 지평선',
    when: ctx => ctx.bossHpPct > 0 && ctx.bossHpPct <= 38,
    lines: {
      analyst:
        '잔여 HP가 낮습니다. 도파민 보상이 가깝습니다 — 마지막 구간만 변수를 줄이세요.',
      creator:
        '클라이맥스 직전입니다. 완벽한 문장보다 닫히는 문장 하나에 힘을 모으세요.',
      capitalist:
        '종료가 시장에 가깝습니다. 남은 리스크 한 가지만 제거하고 마감하세요.',
      adventurer:
        '보스 눈 깜빡입니다. 한 콤보만 — 방패는 잠시 내리고 끝을 노리세요.',
    },
  },
  {
    id: 'optic_micro_reset',
    priority: 48,
    cooldownMs: 240_000,
    title: '미시 시각 리셋',
    when: ctx => ctx.sessionElapsedSec >= 25 * 60 && ctx.sessionElapsedSec < 26 * 60,
    lines: {
      analyst:
        '25분 마이크로 리셋: 20초간 먼 곳 초점을 바꿔 안구 근육과 집중 링을 풀어 주세요.',
      creator:
        '한 막의 중간입니다. 창문 너머 한 줄을 그리지 말고, 그냥 바라만 보세요.',
      capitalist:
        '분기 체크: 20초 스캔으로 눈의 고정 비용을 상각하세요.',
      adventurer:
        '25층까지 왔습니다. 잠깐 발판을 내려다보듯 시야만 멀리 보내세요.',
    },
  },
]

export function resolveCompanionVoice(traits: CompanionTraitId[]): TacticalVoice {
  if (traits.includes('tech')) return 'analyst'
  if (traits.includes('creative')) return 'creator'
  if (traits.includes('finance')) return 'capitalist'
  return 'adventurer'
}

export type TacticalCooldownState = {
  lastAnyAt: number
  byId: Partial<Record<TacticalId, number>>
}

export function createCooldownState(): TacticalCooldownState {
  return { lastAnyAt: 0, byId: {} }
}

/** 우선순위 높은 전술 하나 선택. 조건·쿨다운 불만족 시 null */
export function pickTacticalMessage(
  ctx: TacticalEvalContext,
  voice: TacticalVoice,
  cd: TacticalCooldownState,
  now: number,
): { id: TacticalId; title: string; text: string } | null {
  if (now - cd.lastAnyAt < MIN_ANY_MS) return null

  const sorted = [...NPC_TACTICS].sort((a, b) => b.priority - a.priority)
  for (const t of sorted) {
    if (!t.when(ctx)) continue
    const last = cd.byId[t.id] ?? 0
    if (now - last < t.cooldownMs) continue
    return { id: t.id, title: t.title, text: t.lines[voice] }
  }
  return null
}

export function markTacticFired(cd: TacticalCooldownState, id: TacticalId, now: number): TacticalCooldownState {
  return {
    lastAnyAt: now,
    byId: { ...cd.byId, [id]: now },
  }
}

/** 10분마다 운명선 한 줄 (나비효과 서사) */
export function buildDestinyBriefingLine(input: {
  destinyLabel: string
  questName: string
  projectName: string | null
  areaName: string | null
  valueLabel: string
  blockIndex: number
}): string {
  const place = input.projectName
    ? `${input.areaName ? `${input.areaName} · ` : ''}${input.projectName}`
    : input.areaName ?? '이 전장'
  const seeds = [
    `「${input.destinyLabel}」— ${input.questName}이(가) ${place}에서 장기 서사를 한 뼘 밀어 넣고 있습니다. (${input.valueLabel})`,
    `운명선 스캔 #${input.blockIndex}: 지금 이 세션은 ${input.destinyLabel}의 궤적에 ${input.questName}을(를) 더합니다.`,
    `나비효과: ${input.valueLabel}과 연결된 ${input.questName} — ${place}에서 시간이 쌓이고 있습니다.`,
  ]
  return seeds[input.blockIndex % seeds.length]
}
