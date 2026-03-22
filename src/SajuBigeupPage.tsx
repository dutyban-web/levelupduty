import { useState, type CSSProperties } from 'react'
import { Scroll, Sparkles, Plus, ChevronRight, BookOpen, X } from 'lucide-react'
import { kvSet } from './lib/supabase'

// ═══════════════════════════════════════ SAJU 명리 비급서 ════════════════════
export const SAJU_KEY = 'creative_os_saju_v1'
const GOLD = '#d4a853'
const GOLD_GLOW = 'rgba(212,168,83,0.18)'
const SAJU_NAVY = '#F8F8F6'
const SAJU_CARD = '#FFFFFF'
const SAJU_BDR = 'rgba(212,168,83,0.22)'

type SajuCard = {
  id: string; title: string
  category: '오행' | '십성' | '신살' | '이론' | '기타'
  summary: string; detail: string; savedAt: string
}
type SajuRecord = {
  id: string; name: string; sajuStr: string
  birthdate: string; analysis: string; savedAt: string
}
type SajuStore = { cards: SajuCard[]; records: SajuRecord[] }
type SajuPanel = {
  mode: 'view-card' | 'view-record' | 'edit-card' | 'edit-record' | 'new-card' | 'new-record'
  item?: SajuCard | SajuRecord
}

const CAT_COL: Record<SajuCard['category'], string> = {
  '오행': '#34d399', '십성': '#818cf8', '신살': '#fbbf24', '이론': '#60a5fa', '기타': '#6B6B6B',
}

const GANGSUL_TRAITS = [
  { label: '핵심 이미지', value: '山上木 · 산 위의 나무' },
  { label: '天干 甲木', value: '큰 나무 · 직진성 · 개척자 · 창조력' },
  { label: '地支 戌土', value: '가을 산 · 영적 감수성 · 예술성 · 고독' },
  { label: '강점', value: '독창적 아이디어 · 끈질긴 추진력 · 심리 통찰' },
  { label: '약점', value: '고독 과다 · 현실 마찰 후 좌절 · 완벽주의 지연' },
  { label: '직업 적성', value: '웹툰 작가 · 스토리텔러 · 명리학자 · 심리상담가' },
  { label: '신살', value: '화개살(華蓋) 내포 — 예술 · 영성 · 철학 기질' },
]

const DEFAULT_SAJU_STORE: SajuStore = {
  records: [],
  cards: [
    { id: 's-mok', title: '甲木 (갑목)', category: '오행', summary: '양목, 큰 나무, 직진성, 성장, 봄의 기운', savedAt: '', detail: `[오행] 木  [음양] 양(陽)  [계절] 봄·인월(寅月)\n\n▸ 핵심 특성\n큰 나무처럼 위를 향해 곧게 뻗는 기운. 지도력, 선도성, 개척자 기질. 한번 결심하면 굽히지 않는 직진력.\n\n▸ 강점\n창의적 사고, 강한 추진력, 명확한 비전 제시\n\n▸ 약점\n고집, 타협 부족, 과다 시 현실 감각 부족\n\n▸ 생극제화\n목생화(木生火), 금극목(金剋木), 목극토(木剋土)` },
    { id: 's-hwa', title: '丙火 (병화)', category: '오행', summary: '양화, 태양, 밝음, 열정, 사교성', savedAt: '', detail: `[오행] 火  [음양] 양(陽)  [계절] 여름·오월(午月)\n\n▸ 핵심 특성\n태양처럼 모든 것을 비추는 밝고 뜨거운 기운. 공명심, 화술, 사교적 매력.\n\n▸ 강점\n카리스마, 낙천성, 표현력, 리더십\n\n▸ 약점\n과시, 성급함, 지속력 부족\n\n▸ 생극제화\n화생토(火生土), 수극화(水剋火)` },
    { id: 's-to', title: '戊土 (무토)', category: '오행', summary: '양토, 큰 산, 중용, 안정, 포용력', savedAt: '', detail: `[오행] 土  [음양] 양(陽)  [계절] 환절기·진술축미(辰戌丑未)\n\n▸ 핵심 특성\n큰 산처럼 든든하고 변하지 않는 기운. 중재력, 포용력, 신뢰감.\n\n▸ 강점\n안정감, 신용, 끈기, 중립적 판단력\n\n▸ 약점\n변화 둔감, 고집, 답답함\n\n▸ 생극제화\n토생금(土生金), 목극토(木剋土)` },
    { id: 's-bk', title: '比肩 (비견)', category: '십성', summary: '자아, 동류, 경쟁심, 독립심', savedAt: '', detail: `[십성] 比肩 비견\n[관계] 일간과 같은 오행·같은 음양\n\n▸ 의미\n자신과 같은 기운. 강한 자아, 독립심, 경쟁심.\n\n▸ 긍정적 발현\n자립심, 의지력, 추진력\n\n▸ 부정적 발현 (과다 시)\n아집, 타인 무시, 재물 손실\n\n▸ 역할\n재성(財星) 억제, 관성(官星)과 긴장 관계` },
    { id: 's-hg', title: '華蓋 (화개살)', category: '신살', summary: '예술성, 영적 감수성, 고독, 종교 인연', savedAt: '', detail: `[신살] 華蓋 화개살\n[계산] 연지·일지 기준 — 술(戌)에 내포\n\n▸ 의미\n"화려한 덮개". 예술·종교·철학의 신살.\n\n▸ 특성\n예술적 재능, 철학적 사고, 영적 감수성. 고독·은둔 기질 동반.\n\n▸ 갑술과 연관\n戌土에 화개살 내포 → 창작자·명리학자 기질 강화. 혼자 깊이 파고드는 집중력.` },
  ],
}

function loadSaju(): SajuStore {
  try {
    const raw = localStorage.getItem(SAJU_KEY)
    if (!raw) return DEFAULT_SAJU_STORE
    const saved: SajuStore = JSON.parse(raw)
    const savedIds = new Set((saved.cards ?? []).map(c => c.id))
    const defaults = DEFAULT_SAJU_STORE.cards.filter(c => !savedIds.has(c.id))
    return { cards: [...defaults, ...(saved.cards ?? [])], records: saved.records ?? [] }
  } catch { return DEFAULT_SAJU_STORE }
}
function saveSaju(data: SajuStore) { localStorage.setItem(SAJU_KEY, JSON.stringify(data)); kvSet(SAJU_KEY, data) }

// ── SajuBigeupSection ────────────────────────────────────────────────────────
export function SajuBigeupSection() {
  const [store, setStore] = useState<SajuStore>(() => loadSaju())
  const [subTab, setSubTab] = useState<'library' | 'records'>('library')
  const [panel, setPanel] = useState<SajuPanel | null>(null)
  const [cardDraft, setCardDraft] = useState<Partial<SajuCard>>({})
  const [recDraft, setRecDraft] = useState<Partial<SajuRecord>>({})

  function persist(next: SajuStore) { setStore(next); saveSaju(next) }

  function openCard(c: SajuCard) { setPanel({ mode: 'view-card', item: c }); setCardDraft({ ...c }) }
  function openRecord(r: SajuRecord) { setPanel({ mode: 'view-record', item: r }); setRecDraft({ ...r }) }
  function openNewCard() { setPanel({ mode: 'new-card' }); setCardDraft({ category: '오행', title: '', summary: '', detail: '' }) }
  function openNewRecord() { setPanel({ mode: 'new-record' }); setRecDraft({ name: '', sajuStr: '', birthdate: '', analysis: '' }) }

  function saveCard() {
    const card: SajuCard = {
      id: (panel?.item as SajuCard)?.id ?? `c_${Date.now()}`,
      title: cardDraft.title ?? '', category: cardDraft.category ?? '기타',
      summary: cardDraft.summary ?? '', detail: cardDraft.detail ?? '',
      savedAt: new Date().toISOString(),
    }
    persist({ ...store, cards: panel?.mode === 'new-card' ? [...store.cards, card] : store.cards.map(c => c.id === card.id ? card : c) })
    setPanel(null)
  }
  function saveRecord() {
    const rec: SajuRecord = {
      id: (panel?.item as SajuRecord)?.id ?? `r_${Date.now()}`,
      name: recDraft.name ?? '', sajuStr: recDraft.sajuStr ?? '',
      birthdate: recDraft.birthdate ?? '', analysis: recDraft.analysis ?? '',
      savedAt: new Date().toISOString(),
    }
    persist({ ...store, records: panel?.mode === 'new-record' ? [...store.records, rec] : store.records.map(r => r.id === rec.id ? rec : r) })
    setPanel(null)
  }
  function delCard(id: string) { persist({ ...store, cards: store.cards.filter(c => c.id !== id) }); setPanel(null) }
  function delRecord(id: string) { persist({ ...store, records: store.records.filter(r => r.id !== id) }); setPanel(null) }

  const isCard = panel?.mode?.includes('card')
  const isEditing = panel?.mode?.startsWith('edit') || panel?.mode?.startsWith('new')
  const inp = (extra: CSSProperties = {}): CSSProperties => ({
    width: '100%', backgroundColor: '#F4F4F2', border: `1px solid rgba(212,168,83,0.28)`,
    borderRadius: '10px', padding: '10px 14px', color: '#e8d5a3', fontSize: '13px',
    outline: 'none', boxSizing: 'border-box', ...extra,
  })

  return (
    <div style={{ marginTop: '36px' }}>
      {/* 섹션 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px' }}>
        <Scroll size={17} color={GOLD} />
        <span style={{ fontSize: '11px', fontWeight: 800, color: GOLD, letterSpacing: '0.22em', textTransform: 'uppercase' }}>
          Saju · 사주 명리 비급서
        </span>
        <div style={{ flex: 1, height: '1px', background: `linear-gradient(90deg,${GOLD_GLOW},transparent)` }} />
      </div>

      {/* 메인 컨테이너 — 다크 네이비 */}
      <div style={{ backgroundColor: SAJU_NAVY, borderRadius: '16px', border: `1px solid ${SAJU_BDR}`, overflow: 'hidden' }}>

        {/* ── 갑술 근본 카드 ── */}
        <div style={{ padding: '30px 36px', borderBottom: `1px solid ${SAJU_BDR}`, background: 'linear-gradient(140deg,#0e1228 0%,#0b0d1c 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
            <Sparkles size={15} color={GOLD} />
            <span style={{ fontSize: '10px', fontWeight: 800, color: GOLD, letterSpacing: '0.2em', textTransform: 'uppercase' }}>나의 근본 일주</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginBottom: '22px' }}>
            <h2 style={{ margin: 0, fontSize: '34px', fontWeight: 900, color: '#37352F', fontFamily: 'serif', letterSpacing: '-1px' }}>甲戌 (갑술)</h2>
            <span style={{ fontSize: '14px', color: GOLD, fontWeight: 600 }}>산 위의 나무 · 山上木</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px' }}>
            {GANGSUL_TRAITS.map(t => (
              <div key={t.label}
                style={{ backgroundColor: 'rgba(212,168,83,0.05)', border: `1px solid rgba(212,168,83,0.14)`, borderRadius: '12px', padding: '12px 14px', transition: 'all 0.18s', cursor: 'default' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(212,168,83,0.11)'; e.currentTarget.style.borderColor = 'rgba(212,168,83,0.32)' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(212,168,83,0.05)'; e.currentTarget.style.borderColor = 'rgba(212,168,83,0.14)' }}
              >
                <p style={{ margin: '0 0 5px', fontSize: '9px', fontWeight: 800, color: GOLD, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t.label}</p>
                <p style={{ margin: 0, fontSize: '12px', color: '#ccc', lineHeight: 1.55 }}>{t.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 서브탭 바 ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', borderBottom: `1px solid ${SAJU_BDR}` }}>
          <div style={{ display: 'flex' }}>
            {([
              { id: 'library' as const, label: '📚 명리 지식 창고', count: store.cards.length },
              { id: 'records' as const, label: '☯ 임상 기록부', count: store.records.length },
            ]).map(t => (
              <button key={t.id} onClick={() => setSubTab(t.id)} style={{
                padding: '14px 20px', border: 'none', cursor: 'pointer', backgroundColor: 'transparent',
                borderBottom: `2px solid ${subTab === t.id ? GOLD : 'transparent'}`,
                color: subTab === t.id ? '#fff' : '#787774',
                fontSize: '13px', fontWeight: subTab === t.id ? 700 : 500, transition: 'all 0.15s',
              }}>
                {t.label}
                <span style={{ marginLeft: '8px', fontSize: '10px', fontWeight: 700, color: subTab === t.id ? GOLD : '#AEAAA4' }}>{t.count}</span>
              </button>
            ))}
          </div>
          <button onClick={subTab === 'library' ? openNewCard : openNewRecord} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 16px', borderRadius: '8px', border: `1px solid ${SAJU_BDR}`,
            backgroundColor: 'rgba(212,168,83,0.07)', color: GOLD,
            fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(212,168,83,0.16)' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(212,168,83,0.07)' }}
          >
            <Plus size={13} color={GOLD} />
            {subTab === 'library' ? '이론 카드 추가' : '기록 추가'}
          </button>
        </div>

        {/* ── 명리 지식 창고 ── */}
        {subTab === 'library' && (
          <div style={{ padding: '26px 32px' }}>
            {store.cards.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <Scroll size={30} color="#37352F" />
                <p style={{ margin: '12px 0 0', fontSize: '13px', color: '#AEAAA4' }}>이론 카드가 없습니다</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px' }}>
                {store.cards.map(card => (
                  <div key={card.id} onClick={() => openCard(card)} style={{
                    backgroundColor: SAJU_CARD, border: `1px solid ${SAJU_BDR}`,
                    borderRadius: '16px', padding: '18px 20px', cursor: 'pointer', transition: 'all 0.18s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = `${CAT_COL[card.category]}55`; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 12px 36px rgba(0,0,0,0.5)` }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = SAJU_BDR; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.1em', color: CAT_COL[card.category], backgroundColor: `${CAT_COL[card.category]}15`, border: `1px solid ${CAT_COL[card.category]}30`, padding: '2px 9px', borderRadius: '999px' }}>
                        {card.category}
                      </span>
                      <ChevronRight size={13} color="#3f3f46" />
                    </div>
                    <p style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 800, color: '#e8d5a3', fontFamily: 'serif' }}>{card.title}</p>
                    <p style={{ margin: 0, fontSize: '11px', color: '#787774', lineHeight: 1.5 }}>{card.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 임상 기록부 ── */}
        {subTab === 'records' && (
          <div style={{ padding: '26px 32px' }}>
            {store.records.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <BookOpen size={30} color="#37352F" />
                <p style={{ margin: '12px 0 0', fontSize: '13px', color: '#AEAAA4' }}>분석 기록이 없습니다</p>
                <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#37352F' }}>주변 인물 또는 작품 캐릭터의 사주를 기록해보세요</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {store.records.map(rec => (
                  <div key={rec.id} onClick={() => openRecord(rec)} style={{
                    display: 'flex', alignItems: 'center', gap: '16px',
                    backgroundColor: SAJU_CARD, border: `1px solid ${SAJU_BDR}`,
                    borderRadius: '12px', padding: '14px 18px', cursor: 'pointer', transition: 'all 0.15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = `rgba(212,168,83,0.42)`; e.currentTarget.style.transform = 'translateX(4px)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = SAJU_BDR; e.currentTarget.style.transform = 'translateX(0)' }}
                  >
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0, background: 'linear-gradient(135deg,#1a1f35,#0b0d1c)', border: `1px solid rgba(212,168,83,0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>☯</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '3px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#e8d5a3' }}>{rec.name}</span>
                        {rec.sajuStr && (
                          <span style={{ fontSize: '11px', color: GOLD, fontFamily: 'serif', fontWeight: 700, backgroundColor: 'rgba(212,168,83,0.08)', border: `1px solid rgba(212,168,83,0.22)`, padding: '1px 10px', borderRadius: '999px' }}>
                            {rec.sajuStr}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: '11px', color: '#787774', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {rec.analysis?.slice(0, 64) || '분석 내용 없음'}
                      </p>
                    </div>
                    <ChevronRight size={14} color="#3f3f46" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 사이드 패널 ── */}
      {panel && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 6000 }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.68)' }} onClick={() => setPanel(null)} />
          <div style={{
            position: 'absolute', right: 0, top: 0, height: '100%', width: '520px',
            backgroundColor: SAJU_NAVY, borderLeft: `1px solid ${SAJU_BDR}`,
            display: 'flex', flexDirection: 'column',
            animation: 'slideInRight 0.22s ease-out',
          }}>
            {/* 패널 헤더 */}
            <div style={{ padding: '22px 28px', borderBottom: `1px solid ${SAJU_BDR}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                <Scroll size={15} color={GOLD} />
                <span style={{ fontSize: '11px', fontWeight: 800, color: GOLD, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                  {isCard ? '이론 카드' : '임상 기록'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {(panel.mode === 'view-card' || panel.mode === 'view-record') && (
                  <button onClick={() => setPanel(p => p ? { ...p, mode: p.mode === 'view-card' ? 'edit-card' : 'edit-record' } : null)} style={{ padding: '6px 14px', borderRadius: '8px', border: `1px solid rgba(212,168,83,0.3)`, backgroundColor: 'rgba(212,168,83,0.08)', color: GOLD, fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(212,168,83,0.18)' }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(212,168,83,0.08)' }}
                  >편집</button>
                )}
                <button onClick={() => setPanel(null)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: '#F4F4F2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#EBEBEA' }}
                >
                  <X size={14} color="#9ca3af" />
                </button>
              </div>
            </div>

            {/* 패널 콘텐츠 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '28px 28px 0' }}>
              {isCard && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* 카테고리 */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '9px', fontSize: '9px', fontWeight: 800, color: '#787774', letterSpacing: '0.15em', textTransform: 'uppercase' }}>카테고리</label>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {(['오행', '십성', '신살', '이론', '기타'] as SajuCard['category'][]).map(cat => (
                          <button key={cat} onClick={() => setCardDraft(d => ({ ...d, category: cat }))} style={{ padding: '5px 14px', borderRadius: '999px', border: `1px solid ${cardDraft.category === cat ? CAT_COL[cat] : 'transparent'}`, backgroundColor: cardDraft.category === cat ? `${CAT_COL[cat]}18` : 'rgba(0,0,0,0.03)', color: cardDraft.category === cat ? CAT_COL[cat] : '#787774', fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.12s' }}>
                            {cat}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: '11px', fontWeight: 800, color: CAT_COL[cardDraft.category ?? '기타'], backgroundColor: `${CAT_COL[cardDraft.category ?? '기타']}15`, border: `1px solid ${CAT_COL[cardDraft.category ?? '기타']}30`, padding: '3px 12px', borderRadius: '999px' }}>
                        {cardDraft.category}
                      </span>
                    )}
                  </div>
                  {/* 제목 */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '9px', fontSize: '9px', fontWeight: 800, color: '#787774', letterSpacing: '0.15em', textTransform: 'uppercase' }}>제목</label>
                    {isEditing ? <input value={cardDraft.title ?? ''} onChange={e => setCardDraft(d => ({ ...d, title: e.target.value }))} placeholder="예: 甲木 (갑목)" style={inp({ fontSize: '15px', fontWeight: 700, fontFamily: 'serif', color: '#e8d5a3' })} />
                      : <p style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#e8d5a3', fontFamily: 'serif' }}>{cardDraft.title}</p>}
                  </div>
                  {/* 요약 */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '9px', fontSize: '9px', fontWeight: 800, color: '#787774', letterSpacing: '0.15em', textTransform: 'uppercase' }}>요약</label>
                    {isEditing ? <input value={cardDraft.summary ?? ''} onChange={e => setCardDraft(d => ({ ...d, summary: e.target.value }))} placeholder="한 줄 요약" style={inp()} />
                      : <p style={{ margin: 0, fontSize: '13px', color: '#9B9A97', lineHeight: 1.6 }}>{cardDraft.summary}</p>}
                  </div>
                  {/* 상세 */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '9px', fontSize: '9px', fontWeight: 800, color: '#787774', letterSpacing: '0.15em', textTransform: 'uppercase' }}>상세 내용</label>
                    {isEditing
                      ? <textarea value={cardDraft.detail ?? ''} onChange={e => setCardDraft(d => ({ ...d, detail: e.target.value }))} placeholder="특성, 생극제화, 활용법 등..." rows={12} style={inp({ lineHeight: '1.8', resize: 'vertical', fontFamily: 'serif' }) as CSSProperties} />
                      : <div style={{ backgroundColor: '#F4F4F2', border: `1px solid ${SAJU_BDR}`, borderRadius: '10px', padding: '18px 20px' }}>
                        <pre style={{ margin: 0, fontSize: '13px', color: '#37352F', lineHeight: '1.9', fontFamily: 'serif', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{cardDraft.detail}</pre>
                      </div>
                    }
                  </div>
                </div>
              )}

              {!isCard && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* 인물명 */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '9px', fontSize: '9px', fontWeight: 800, color: '#787774', letterSpacing: '0.15em', textTransform: 'uppercase' }}>인물 / 캐릭터명</label>
                    {isEditing ? <input value={recDraft.name ?? ''} onChange={e => setRecDraft(d => ({ ...d, name: e.target.value }))} placeholder="예: 김00, 웹툰 주인공A" style={inp({ fontSize: '15px', fontWeight: 700, color: '#e8d5a3' })} />
                      : <p style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#e8d5a3' }}>{recDraft.name}</p>}
                  </div>
                  {/* 사주 + 생년월일 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '9px', fontSize: '9px', fontWeight: 800, color: '#787774', letterSpacing: '0.15em', textTransform: 'uppercase' }}>사주 표기</label>
                      {isEditing ? <input value={recDraft.sajuStr ?? ''} onChange={e => setRecDraft(d => ({ ...d, sajuStr: e.target.value }))} placeholder="甲戌 壬子 庚辰 丙午" style={inp({ color: GOLD, fontFamily: 'serif' })} />
                        : <p style={{ margin: 0, fontSize: '14px', color: GOLD, fontFamily: 'serif', fontWeight: 700 }}>{recDraft.sajuStr || '—'}</p>}
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '9px', fontSize: '9px', fontWeight: 800, color: '#787774', letterSpacing: '0.15em', textTransform: 'uppercase' }}>생년월일</label>
                      {isEditing ? <input value={recDraft.birthdate ?? ''} onChange={e => setRecDraft(d => ({ ...d, birthdate: e.target.value }))} placeholder="1990-05-10" style={inp()} />
                        : <p style={{ margin: 0, fontSize: '13px', color: '#9B9A97' }}>{recDraft.birthdate || '—'}</p>}
                    </div>
                  </div>
                  {/* 분석 기록 */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '9px', fontSize: '9px', fontWeight: 800, color: '#787774', letterSpacing: '0.15em', textTransform: 'uppercase' }}>분석 기록</label>
                    {isEditing
                      ? <textarea value={recDraft.analysis ?? ''} onChange={e => setRecDraft(d => ({ ...d, analysis: e.target.value }))} placeholder="용신, 격국, 특성 분석, 운세 흐름..." rows={12} style={inp({ lineHeight: '1.8', resize: 'vertical', fontFamily: 'serif' }) as CSSProperties} />
                      : <div style={{ backgroundColor: '#F4F4F2', border: `1px solid ${SAJU_BDR}`, borderRadius: '10px', padding: '18px 20px' }}>
                        <pre style={{ margin: 0, fontSize: '13px', color: '#37352F', lineHeight: '1.9', fontFamily: 'serif', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{recDraft.analysis || '분석 내용이 없습니다'}</pre>
                      </div>
                    }
                  </div>
                </div>
              )}
            </div>

            {/* 패널 푸터 */}
            {isEditing && (
              <div style={{ padding: '20px 28px', borderTop: `1px solid ${SAJU_BDR}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div>
                  {(panel.mode === 'edit-card' || panel.mode === 'edit-record') && panel.item && (
                    <button onClick={() => isCard ? delCard((panel.item as SajuCard).id) : delRecord((panel.item as SajuRecord).id)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.07)', color: '#ef4444', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.16)' }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.07)' }}
                    >삭제</button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setPanel(null)} style={{ padding: '8px 18px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: 'transparent', color: '#9B9A97', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>취소</button>
                  <button onClick={isCard ? saveCard : saveRecord} style={{ padding: '8px 24px', borderRadius: '8px', border: `1px solid ${SAJU_BDR}`, background: 'linear-gradient(135deg,#1a1a2e,#0f1428)', color: GOLD, fontSize: '12px', fontWeight: 800, cursor: 'pointer', boxShadow: `0 4px 16px rgba(212,168,83,0.2)`, transition: 'box-shadow 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 8px 28px rgba(212,168,83,0.38)` }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 4px 16px rgba(212,168,83,0.2)` }}
                  >저장</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
