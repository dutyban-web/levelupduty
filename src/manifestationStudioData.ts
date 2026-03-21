/**
 * Manifestation 스튜디오 — 확언·비전보드·자서전 등 확장 블록 (localStorage + app_kv)
 */
import { kvSet } from './lib/supabase'

export const MANIFEST_STUDIO_BUNDLE_KEY = 'manifestation_studio_bundle_v1'

export function newStudioId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `ms-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export type StudioTextItem = {
  id: string
  title: string
  body: string
  updatedAt: string
}

export type VisionImage = {
  id: string
  imageUrl: string
  caption?: string
}

export type VisionBoard = {
  id: string
  title: string
  items: VisionImage[]
  updatedAt: string
}

export type FutureInstaPost = {
  id: string
  caption: string
  imageUrl?: string
  sortOrder: number
  updatedAt: string
}

export type AutobiographyDraft = {
  bookTitle: string
  subtitle: string
  /** 일반 자서전 흐름 — 섹션별 본문 */
  birthAndFamily: string
  childhood: string
  educationAndGrowth: string
  careerAndWork: string
  relationships: string
  hardshipsAndOvercoming: string
  turningPoints: string
  beliefsAndValues: string
  todayAndFuture: string
  legacy: string
  freeNotes: string
}

export type BranchScenario = {
  id: string
  /** 분기점 순간 */
  moment: string
  /** 달랐다면 어땠을지 */
  alternateOutcome: string
  updatedAt: string
}

export type OthersLifeEntry = {
  id: string
  /** 예: 타인의삶, 도전 */
  tags: string[]
  title: string
  body: string
  updatedAt: string
}

export type EffortCard = {
  id: string
  title: string
  body: string
  imageUrl?: string
  updatedAt: string
}

export type NegativeRipplePair = {
  id: string
  /** 부정적 원인 행동 */
  badAction: string
  /** 부정적 결과·파급 */
  badOutcome: string
  updatedAt: string
}

export type ManifestStudioBundle = {
  version: 1
  affirmations: StudioTextItem[]
  visionBoards: VisionBoard[]
  transurfingScene: string
  futureInsta: FutureInstaPost[]
  autobiography: AutobiographyDraft
  /** 될 일은 된다 — 불안했지만 결국 이뤄진 일 */
  willComeTrue: StudioTextItem[]
  timingOfSuccess: StudioTextItem[]
  pastReconstruction: StudioTextItem[]
  meantForThis: StudioTextItem[]
  reversalOpportunities: StudioTextItem[]
  repayingPeople: StudioTextItem[]
  branchScenarios: BranchScenario[]
  feelingAmplify: StudioTextItem[]
  othersLives: OthersLifeEntry[]
  negativeRipple: NegativeRipplePair[]
  effortGained: EffortCard[]
  effortMissed: EffortCard[]
}

export function defaultManifestStudioBundle(): ManifestStudioBundle {
  return {
    version: 1,
    affirmations: [],
    visionBoards: [],
    transurfingScene: '',
    futureInsta: [],
    autobiography: {
      bookTitle: '',
      subtitle: '',
      birthAndFamily: '',
      childhood: '',
      educationAndGrowth: '',
      careerAndWork: '',
      relationships: '',
      hardshipsAndOvercoming: '',
      turningPoints: '',
      beliefsAndValues: '',
      todayAndFuture: '',
      legacy: '',
      freeNotes: '',
    },
    willComeTrue: [],
    timingOfSuccess: [],
    pastReconstruction: [],
    meantForThis: [],
    reversalOpportunities: [],
    repayingPeople: [],
    branchScenarios: [],
    feelingAmplify: [],
    othersLives: [],
    negativeRipple: [],
    effortGained: [],
    effortMissed: [],
  }
}

function migrate(raw: unknown): ManifestStudioBundle {
  const d = defaultManifestStudioBundle()
  if (!raw || typeof raw !== 'object') return d
  const o = raw as Record<string, unknown>
  const pickArr = <T>(k: string, def: T[]): T[] => (Array.isArray(o[k]) ? (o[k] as T[]) : def)
  return {
    ...d,
    affirmations: pickArr('affirmations', d.affirmations),
    visionBoards: pickArr('visionBoards', d.visionBoards),
    transurfingScene: typeof o.transurfingScene === 'string' ? o.transurfingScene : d.transurfingScene,
    futureInsta: pickArr('futureInsta', d.futureInsta),
    autobiography:
      o.autobiography && typeof o.autobiography === 'object'
        ? { ...d.autobiography, ...(o.autobiography as AutobiographyDraft) }
        : d.autobiography,
    willComeTrue: pickArr('willComeTrue', d.willComeTrue),
    timingOfSuccess: pickArr('timingOfSuccess', d.timingOfSuccess),
    pastReconstruction: pickArr('pastReconstruction', d.pastReconstruction),
    meantForThis: pickArr('meantForThis', d.meantForThis),
    reversalOpportunities: pickArr('reversalOpportunities', d.reversalOpportunities),
    repayingPeople: pickArr('repayingPeople', d.repayingPeople),
    branchScenarios: pickArr('branchScenarios', d.branchScenarios),
    feelingAmplify: pickArr('feelingAmplify', d.feelingAmplify),
    othersLives: pickArr('othersLives', d.othersLives),
    negativeRipple: pickArr('negativeRipple', d.negativeRipple),
    effortGained: pickArr('effortGained', d.effortGained),
    effortMissed: pickArr('effortMissed', d.effortMissed),
  }
}

export function loadManifestStudio(): ManifestStudioBundle {
  try {
    const raw = localStorage.getItem(MANIFEST_STUDIO_BUNDLE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as unknown
      return migrate(p)
    }
  } catch {
    /* ignore */
  }
  return defaultManifestStudioBundle()
}

export function saveManifestStudio(b: ManifestStudioBundle): void {
  try {
    const payload: ManifestStudioBundle = { ...b, version: 1 }
    localStorage.setItem(MANIFEST_STUDIO_BUNDLE_KEY, JSON.stringify(payload))
    void kvSet(MANIFEST_STUDIO_BUNDLE_KEY, payload)
  } catch {
    /* quota */
  }
}
