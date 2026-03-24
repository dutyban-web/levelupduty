/**
 * 내실 관리 — People(동료) · Treasury(창고) · Library(지식/핀)
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Users, Package, MapPin, Plus, Trash2, Sparkles, MessageCircle, ArrowLeftRight } from 'lucide-react'
import { loadNetworkStore, type NetworkContact } from './networkData'
import { MAP_ZONES, type MapZoneId } from './mapHubZones'
import {
  loadInnerWorldStore,
  saveInnerWorldStore,
  newId,
  detectTreasuryKind,
  parseYoutubeTime,
  youtubeEmbedUrl,
  parseThemeTags,
  COMPANION_TRAITS,
  type CompanionCard,
  type CompanionTraitId,
  type TreasuryKind,
  type TreasuryTier,
  type TreasuryLoot,
  type MapMemoPin,
  type InnerWorldStore,
  type HelpExchangeEntry,
} from './lifeWorldData'
import { applyInnerWorldCompanionActivity } from './questRpgIntegration'
import { loadGarrisonTacticalAlly, setTacticalAllyCompanionId } from './garrisonTacticalAllyData'
import { resolveCompanionVoice } from './NpcTacticalSystem'

type Tab = 'people' | 'treasury' | 'library'

const KIND_LABEL: Record<TreasuryKind, string> = {
  pdf: 'PDF',
  image: '이미지',
  audio: '오디오',
  youtube: 'YouTube',
  link: '링크',
  other: '기타',
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10)
}

export function LifeWorldHub({
  adjustXp,
  fireToast,
}: {
  adjustXp: (n: number) => void
  fireToast: (msg: string) => void
}) {
  const [tab, setTab] = useState<Tab>('people')
  const [store, setStore] = useState<InnerWorldStore>(() => loadInnerWorldStore())
  const [netContacts, setNetContacts] = useState<NetworkContact[]>([])

  const refresh = useCallback(() => {
    setStore(loadInnerWorldStore())
    setNetContacts(loadNetworkStore().contacts.filter(c => c.is_deleted !== true))
  }, [])

  useEffect(() => {
    refresh()
    const h = () => refresh()
    window.addEventListener('bl-inner-world-sync', h)
    return () => window.removeEventListener('bl-inner-world-sync', h)
  }, [refresh])

  const reputation = store.reputation

  const companions = store.companions
  const treasury = store.treasury
  const pins = store.mapPins

  const [newName, setNewName] = useState('')
  const [newKeywords, setNewKeywords] = useState('')
  const [newTraits, setNewTraits] = useState<CompanionTraitId[]>(['ally'])
  const [linkNetId, setLinkNetId] = useState('')
  const [helpDraft, setHelpDraft] = useState<Record<string, { note: string; dir: 'give' | 'receive' }>>({})
  const [tacticalAllyId, setTacticalAllyId] = useState<string | null>(() => loadGarrisonTacticalAlly().companionId)

  useEffect(() => {
    const h = () => setTacticalAllyId(loadGarrisonTacticalAlly().companionId)
    window.addEventListener('bl-garrison-tactical-ally-sync', h)
    return () => window.removeEventListener('bl-garrison-tactical-ally-sync', h)
  }, [])

  const addCompanion = () => {
    const name = newName.trim()
    if (!name) {
      fireToast('이름을 입력하세요.')
      return
    }
    const now = new Date().toISOString()
    const c: CompanionCard = {
      id: newId('cmp'),
      name,
      affinity: 35,
      lastInteractionYmd: todayYmd(),
      traits: newTraits.length ? newTraits : ['ally'],
      networkContactId: linkNetId || undefined,
      memo: '',
      dialogKeywords: newKeywords.trim(),
      helpExchangeLog: [],
      createdAt: now,
      updatedAt: now,
    }
    const st0 = loadInnerWorldStore()
    saveInnerWorldStore({ ...st0, companions: [c, ...st0.companions] })
    refresh()
    setNewName('')
    setNewKeywords('')
    fireToast('동료 카드가 추가되었습니다.')
  }

  const patchCompanion = (id: string, patch: Partial<CompanionCard>) => {
    const st = loadInnerWorldStore()
    const companions = st.companions.map(c =>
      c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c,
    )
    saveInnerWorldStore({ ...st, companions })
    refresh()
  }

  const addHelpExchange = (companionId: string) => {
    const draft = helpDraft[companionId] ?? { note: '', dir: 'give' as const }
    const note = draft.note.trim()
    if (!note) {
      fireToast('도움 기록 내용을 적어 주세요.')
      return
    }
    const entry: HelpExchangeEntry = {
      id: newId('hex'),
      dateYmd: todayYmd(),
      direction: draft.dir,
      note,
    }
    const st = loadInnerWorldStore()
    const c = st.companions.find(x => x.id === companionId)
    if (!c) return
    const next: CompanionCard = {
      ...c,
      helpExchangeLog: [entry, ...c.helpExchangeLog].slice(0, 40),
      lastInteractionYmd: todayYmd(),
      updatedAt: new Date().toISOString(),
    }
    saveInnerWorldStore({
      ...st,
      companions: st.companions.map(x => (x.id === companionId ? next : x)),
    })
    setHelpDraft(prev => ({ ...prev, [companionId]: { note: '', dir: draft.dir } }))
    adjustXp(2)
    refresh()
    fireToast('도움 기록이 저장되었습니다 · +2 EXP')
  }

  const logCompanionActivity = (id: string) => {
    const st = loadInnerWorldStore()
    const idx = st.companions.findIndex(x => x.id === id)
    if (idx < 0) return
    const g = applyInnerWorldCompanionActivity()
    adjustXp(5)
    const cur = st.companions[idx]
    const nextC: CompanionCard = {
      ...cur,
      affinity: Math.min(100, cur.affinity + 4),
      lastInteractionYmd: todayYmd(),
      updatedAt: new Date().toISOString(),
    }
    const companions = st.companions.map((x, i) => (i === idx ? nextC : x))
    saveInnerWorldStore({ ...st, companions, reputation: st.reputation + 3 })
    refresh()
    fireToast(`동료 가치 활동 · +${g} G · 명성 +3 · 우호도 +4`)
  }

  const removeCompanion = (id: string) => {
    if (!window.confirm('이 동료 카드를 삭제할까요?')) return
    const st = loadInnerWorldStore()
    saveInnerWorldStore({ ...st, companions: st.companions.filter(c => c.id !== id) })
    refresh()
  }

  const [tUrl, setTUrl] = useState('')
  const [tTitle, setTTitle] = useState('')
  const [tMemo, setTMemo] = useState('')
  const [tTier, setTTier] = useState<TreasuryTier>('loot')
  const [tZone, setTZone] = useState<MapZoneId | ''>('')
  const [tYt, setTYt] = useState('')
  const [tStrat, setTStrat] = useState('')
  const [tFilter, setTFilter] = useState<TreasuryKind | 'all'>('all')
  const [tTierFilter, setTTierFilter] = useState<TreasuryTier | 'all'>('all')

  const addTreasury = () => {
    const url = tUrl.trim()
    if (!url) {
      fireToast('URL을 입력하세요.')
      return
    }
    const kind = detectTreasuryKind(url)
    const title = tTitle.trim() || url.slice(0, 48)
    const ts = kind === 'youtube' ? parseYoutubeTime(tYt) : null
    const loot: TreasuryLoot = {
      id: newId('loot'),
      kind,
      tier: tTier,
      title,
      url,
      memo: tMemo.trim(),
      createdAt: new Date().toISOString(),
      youtubeTimestampSec: ts,
      strategyMemo: kind === 'youtube' ? tStrat.trim() || undefined : undefined,
      mapZoneId: tZone || null,
    }
    const st = loadInnerWorldStore()
    saveInnerWorldStore({ ...st, treasury: [loot, ...st.treasury] })
    adjustXp(3)
    refresh()
    setTUrl('')
    setTTitle('')
    setTMemo('')
    setTYt('')
    setTStrat('')
    setTZone('')
    setTTier('loot')
    fireToast(`전리품 등록 · +3 EXP`)
  }

  const removeLoot = (id: string) => {
    if (!window.confirm('이 전리품을 삭제할까요?')) return
    const st = loadInnerWorldStore()
    saveInnerWorldStore({ ...st, treasury: st.treasury.filter(x => x.id !== id) })
    refresh()
  }

  const filteredLoot = useMemo(() => {
    let list = treasury
    if (tFilter !== 'all') list = list.filter(x => x.kind === tFilter)
    if (tTierFilter !== 'all') list = list.filter(x => x.tier === tTierFilter)
    return list
  }, [treasury, tFilter, tTierFilter])

  const [pinZone, setPinZone] = useState<MapZoneId>('creative_forest')
  const [pinTitle, setPinTitle] = useState('')
  const [pinBody, setPinBody] = useState('')
  const [pinTheme, setPinTheme] = useState('')
  const [pinLoot, setPinLoot] = useState('')
  const [pinSearch, setPinSearch] = useState('')

  const addPin = () => {
    const title = pinTitle.trim()
    if (!title) {
      fireToast('핀 제목을 입력하세요.')
      return
    }
    const p: MapMemoPin = {
      id: newId('pin'),
      mapZoneId: pinZone,
      title,
      body: pinBody.trim(),
      themeTags: parseThemeTags(pinTheme),
      createdAt: new Date().toISOString(),
      treasuryLootId: pinLoot || undefined,
    }
    const st = loadInnerWorldStore()
    saveInnerWorldStore({ ...st, mapPins: [p, ...st.mapPins] })
    adjustXp(2)
    refresh()
    setPinTitle('')
    setPinBody('')
    setPinTheme('')
    setPinLoot('')
    fireToast('지도에 핀이 꽂혔습니다 · +2 EXP')
  }

  const removePin = (id: string) => {
    if (!window.confirm('이 핀을 제거할까요?')) return
    const st = loadInnerWorldStore()
    saveInnerWorldStore({ ...st, mapPins: st.mapPins.filter(x => x.id !== id) })
    refresh()
  }

  const pinsByZone = useMemo(() => {
    const m = new Map<MapZoneId, MapMemoPin[]>()
    for (const z of MAP_ZONES) m.set(z.id, [])
    for (const p of pins) {
      const arr = m.get(p.mapZoneId) ?? []
      arr.push(p)
      m.set(p.mapZoneId, arr)
    }
    return m
  }, [pins])

  const knowledgeLoot = useMemo(
    () => treasury.filter(t => t.kind === 'pdf' || t.kind === 'youtube' || t.kind === 'link'),
    [treasury],
  )

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px 40px' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 22, color: '#1e293b' }}>내실 관리 · Inner World</h1>
        <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
          인맥은 연락처가 아니라 나를 돕는 <b>소환수·동료</b>로, 자료는 <b>전리품·유물</b>로. 주변 사람의 가치를 올리면 나도 함께 자랍니다.
          <br />
          명성 <b style={{ color: '#4f46e5' }}>{reputation}</b> · MapHub 구역과 영토 핀(태그)을 공유합니다.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {(
          [
            ['people', 'People', Users],
            ['treasury', 'Treasury', Package],
            ['library', 'Library', MapPin],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: 12,
              border: tab === k ? '2px solid #6366f1' : '1px solid rgba(0,0,0,0.08)',
              background: tab === k ? 'rgba(99,102,241,0.12)' : '#fff',
              color: tab === k ? '#4338ca' : '#64748b',
              fontWeight: 800,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            <Icon size={18} /> {label}
          </button>
        ))}
      </div>

      {tab === 'people' && (
        <div>
          <div
            style={{
              padding: 16,
              borderRadius: 14,
              border: '1px solid rgba(0,0,0,0.06)',
              background: '#f8fafc',
              marginBottom: 20,
            }}
          >
            <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 800, color: '#475569' }}>병영 The Garrison — 동료(소환수) 카드 추가</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="이름"
                style={{ flex: '1 1 160px', padding: 8, borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <input
                value={newKeywords}
                onChange={e => setNewKeywords(e.target.value)}
                placeholder="주요 대화 키워드 (쉼표 구분)"
                style={{ flex: '1 1 220px', padding: 8, borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <select
                value={linkNetId}
                onChange={e => setLinkNetId(e.target.value)}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #e2e8f0', minWidth: 160 }}
              >
                <option value="">Net 명부 연결 (선택)</option>
                {netContacts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button type="button" onClick={addCompanion} style={btnPrimary}>
                <Plus size={16} style={{ marginRight: 4 }} /> 추가
              </button>
            </div>
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {COMPANION_TRAITS.map(t => {
                const on = newTraits.includes(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setNewTraits(prev => (on ? prev.filter(x => x !== t.id) : [...prev, t.id]))
                    }
                    style={{
                      padding: '4px 10px',
                      borderRadius: 999,
                      border: on ? '1px solid #6366f1' : '1px solid #e2e8f0',
                      background: on ? 'rgba(99,102,241,0.15)' : '#fff',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    {t.emoji} {t.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div
            style={{
              padding: 16,
              borderRadius: 14,
              border: '1px solid rgba(56,189,248,0.35)',
              background: 'linear-gradient(165deg, #0f172a 0%, #1e293b 100%)',
              marginBottom: 20,
              color: '#e2e8f0',
            }}
          >
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 800, color: '#7dd3fc', letterSpacing: '0.06em' }}>
              전술 조력자 Tactical Ally — 몰입(전투) HUD
            </p>
            <p style={{ margin: '0 0 12px', fontSize: 11, color: '#94a3b8', lineHeight: 1.55 }}>
              병영에 등록된 동료 중 한 명을 선택하면 <b>TAC-NET</b> 무전과 전술 대사 톤이 그 동료 성향(분석·창작·자본·탐험)에 맞춰집니다.
            </p>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#cbd5e1', display: 'block', marginBottom: 6 }}>현재 조력자</label>
            <select
              value={tacticalAllyId ?? ''}
              onChange={e => {
                const v = e.target.value || null
                setTacticalAllyId(v)
                setTacticalAllyCompanionId(v)
              }}
              style={{
                width: '100%',
                maxWidth: 360,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(56,189,248,0.4)',
                background: 'rgba(15,23,42,0.85)',
                color: '#f1f5f9',
                fontSize: 13,
              }}
            >
              <option value="">시스템 기본 (탐험가 톤)</option>
              {companions.map(c => {
                const v = resolveCompanionVoice(c.traits)
                const tone = v === 'analyst' ? '분석' : v === 'creator' ? '창작' : v === 'capitalist' ? '자본' : '모험'
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} · {tone} 톤
                  </option>
                )
              })}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
            {companions.map(c => (
              <div
                key={c.id}
                style={{
                  borderRadius: 14,
                  border: '1px solid rgba(99,102,241,0.25)',
                  background: 'linear-gradient(165deg, #fff, #eef2ff)',
                  padding: 14,
                  boxShadow: '0 4px 14px rgba(15,23,42,0.06)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#1e293b' }}>{c.name}</p>
                    <p style={{ margin: '6px 0 0', fontSize: 11, color: '#64748b' }}>
                      우호도 <b style={{ color: '#4f46e5' }}>{c.affinity}</b> / 100 · 최근 교류 {c.lastInteractionYmd || '—'}
                    </p>
                    {c.dialogKeywords ? (
                      <p style={{ margin: '8px 0 0', fontSize: 11, color: '#334155' }}>
                        <MessageCircle size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                        키워드: {c.dialogKeywords}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    title="삭제"
                    onClick={() => removeCompanion(c.id)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <input
                  key={`kw-${c.id}-${c.updatedAt}`}
                  defaultValue={c.dialogKeywords}
                  onBlur={e => {
                    const v = e.target.value
                    if (v !== c.dialogKeywords) patchCompanion(c.id, { dialogKeywords: v })
                  }}
                  placeholder="대화 키워드 편집 (저장: 포커스 밖으로)"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    marginTop: 8,
                    padding: 6,
                    fontSize: 11,
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                  }}
                />
                <p style={{ margin: '8px 0 4px', fontSize: 10, fontWeight: 800, color: '#64748b' }}>
                  <ArrowLeftRight size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  도움 주고받은 기록
                </p>
                <ul style={{ margin: 0, paddingLeft: 16, maxHeight: 88, overflow: 'auto', fontSize: 11, color: '#475569' }}>
                  {(c.helpExchangeLog ?? []).slice(0, 8).map(h => (
                    <li key={h.id} style={{ marginBottom: 4 }}>
                      <span style={{ color: '#94a3b8' }}>{h.dateYmd}</span>{' '}
                      {h.direction === 'give' ? '↗ 준 도움' : '↙ 받은 도움'} — {h.note}
                    </li>
                  ))}
                </ul>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <select
                    value={helpDraft[c.id]?.dir ?? 'give'}
                    onChange={e =>
                      setHelpDraft(prev => ({
                        ...prev,
                        [c.id]: { note: prev[c.id]?.note ?? '', dir: e.target.value as 'give' | 'receive' },
                      }))
                    }
                    style={{ padding: 4, borderRadius: 6, fontSize: 11, border: '1px solid #e2e8f0' }}
                  >
                    <option value="give">내가 준 도움</option>
                    <option value="receive">받은 도움</option>
                  </select>
                  <input
                    value={helpDraft[c.id]?.note ?? ''}
                    onChange={e =>
                      setHelpDraft(prev => ({
                        ...prev,
                        [c.id]: { dir: prev[c.id]?.dir ?? 'give', note: e.target.value },
                      }))
                    }
                    placeholder="한 줄 기록"
                    style={{ flex: 1, minWidth: 100, padding: 4, borderRadius: 6, fontSize: 11, border: '1px solid #e2e8f0' }}
                  />
                  <button
                    type="button"
                    onClick={() => addHelpExchange(c.id)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid #6366f1',
                      background: '#fff',
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#4f46e5',
                      cursor: 'pointer',
                    }}
                  >
                    추가
                  </button>
                </div>
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {c.traits.map(tid => {
                    const meta = COMPANION_TRAITS.find(x => x.id === tid)
                    return (
                      <span
                        key={tid}
                        style={{
                          fontSize: 10,
                          padding: '2px 6px',
                          borderRadius: 6,
                          background: 'rgba(99,102,241,0.12)',
                          color: '#4338ca',
                        }}
                      >
                        {meta?.emoji} {meta?.label ?? tid}
                      </span>
                    )
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => logCompanionActivity(c.id)}
                  style={{
                    marginTop: 12,
                    width: '100%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '8px 0',
                    borderRadius: 10,
                    border: 'none',
                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  <Sparkles size={15} /> 가치 활동 기록 (명성↑)
                </button>
              </div>
            ))}
          </div>
          {companions.length === 0 && (
            <p style={{ color: '#94a3b8', fontSize: 13 }}>동료를 등록해 보세요. Net 명부와 연결할 수 있습니다.</p>
          )}
        </div>
      )}

      {tab === 'treasury' && (
        <div>
          <div
            style={{
              padding: 16,
              borderRadius: 14,
              border: '1px solid rgba(0,0,0,0.06)',
              background: '#f8fafc',
              marginBottom: 16,
            }}
          >
            <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 800, color: '#475569' }}>
              보물 창고 The Treasury — 전리품 / 유물
            </p>
            <select
              value={tTier}
              onChange={e => setTTier(e.target.value as TreasuryTier)}
              style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 8 }}
            >
              <option value="loot">전리품 (Loot)</option>
              <option value="artifact">유물 (Artifact)</option>
            </select>
            <input
              value={tUrl}
              onChange={e => {
                setTUrl(e.target.value)
                setTTitle('')
              }}
              placeholder="https://… (PDF, 이미지, mp3, 유튜브)"
              style={{ width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 8 }}
            />
            <input
              value={tTitle}
              onChange={e => setTTitle(e.target.value)}
              placeholder="제목 (비우면 URL 일부 사용)"
              style={{ width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 8 }}
            />
            <textarea
              value={tMemo}
              onChange={e => setTMemo(e.target.value)}
              placeholder="메모"
              rows={2}
              style={{ width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 8 }}
            />
            {detectTreasuryKind(tUrl) === 'youtube' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input
                  value={tYt}
                  onChange={e => setTYt(e.target.value)}
                  placeholder="전략 타임라인 (초 또는 1:30)"
                  style={{ padding: 8, borderRadius: 8, border: '1px solid #fbbf24' }}
                />
                <input
                  value={tStrat}
                  onChange={e => setTStrat(e.target.value)}
                  placeholder="전략 비디오 메모"
                  style={{ padding: 8, borderRadius: 8, border: '1px solid #fbbf24' }}
                />
              </div>
            )}
            <select
              value={tZone}
              onChange={e => setTZone(e.target.value as MapZoneId | '')}
              style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 8 }}
            >
              <option value="">지도 구역 핀 (선택)</option>
              {MAP_ZONES.map(z => (
                <option key={z.id} value={z.id}>
                  {z.emoji} {z.label}
                </option>
              ))}
            </select>
            <button type="button" onClick={addTreasury} style={btnPrimary}>
              전리품 저장
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>확장자</span>
            {(['all', 'pdf', 'image', 'audio', 'youtube', 'link', 'other'] as const).map(k => (
              <button
                key={k}
                type="button"
                onClick={() => setTFilter(k)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: tFilter === k ? '1px solid #6366f1' : '1px solid #e2e8f0',
                  background: tFilter === k ? 'rgba(99,102,241,0.1)' : '#fff',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                {k === 'all' ? '전체' : KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>등급</span>
            {(['all', 'loot', 'artifact'] as const).map(k => (
              <button
                key={k}
                type="button"
                onClick={() => setTTierFilter(k)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: tTierFilter === k ? '1px solid #b45309' : '1px solid #e2e8f0',
                  background: tTierFilter === k ? 'rgba(251,191,36,0.15)' : '#fff',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                {k === 'all' ? '전체' : k === 'loot' ? '전리품' : '유물'}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {filteredLoot.map(loot => (
              <div
                key={loot.id}
                style={{
                  borderRadius: 12,
                  overflow: 'hidden',
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div
                  style={{
                    height: 100,
                    background:
                      loot.kind === 'image'
                        ? `url(${loot.url}) center/cover no-repeat, #f1f5f9`
                        : 'linear-gradient(135deg, #e0e7ff, #f8fafc)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 36,
                  }}
                >
                  {loot.kind === 'pdf' && '📄'}
                  {loot.kind === 'youtube' && '▶️'}
                  {loot.kind === 'audio' && '🎵'}
                  {loot.kind === 'link' && '🔗'}
                  {loot.kind === 'image' && !loot.url.match(/\.(jpg|png|webp|gif)/i) && '🖼️'}
                  {loot.kind === 'other' && '📦'}
                </div>
                <div style={{ padding: 10, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: loot.tier === 'artifact' ? '#b45309' : '#64748b' }}>
                    {loot.tier === 'artifact' ? '✦ 유물' : '◇ 전리품'}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 800, color: '#1e293b' }}>{loot.title}</p>
                  <p style={{ margin: '6px 0 0', fontSize: 10, color: '#94a3b8' }}>{KIND_LABEL[loot.kind]}</p>
                  {loot.kind === 'youtube' && (loot.strategyMemo || loot.youtubeTimestampSec != null) && (
                    <p style={{ margin: '8px 0 0', fontSize: 11, color: '#b45309', lineHeight: 1.4 }}>
                      {loot.youtubeTimestampSec != null && <>⏱ {loot.youtubeTimestampSec}s · </>}
                      {loot.strategyMemo}
                    </p>
                  )}
                  {loot.mapZoneId && (
                    <p style={{ margin: '6px 0 0', fontSize: 10, color: '#6366f1' }}>
                      📍 {MAP_ZONES.find(z => z.id === loot.mapZoneId)?.label ?? loot.mapZoneId}
                    </p>
                  )}
                  <a href={loot.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#2563eb', wordBreak: 'break-all' as const }}>
                    열기
                  </a>
                  {loot.kind === 'youtube' && (
                    <div style={{ marginTop: 8, borderRadius: 8, overflow: 'hidden', aspectRatio: '16/9', background: '#000' }}>
                      <iframe
                        title={loot.title}
                        src={youtubeEmbedUrl(loot.url, loot.youtubeTimestampSec)}
                        style={{ width: '100%', height: 120, border: 'none' }}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeLoot(loot.id)}
                  style={{
                    border: 'none',
                    borderTop: '1px solid #f1f5f9',
                    padding: 8,
                    background: '#fafafa',
                    cursor: 'pointer',
                    color: '#ef4444',
                    fontSize: 11,
                  }}
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'library' && (
        <div>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12, lineHeight: 1.6 }}>
            <b>공간적 지식 지도</b>: 월드 맵 구역을 누르면 그 영토에 꽂은 노트가 뜹니다. 태그(예: 사우디아라비아)로 주제를 묶어 &quot;영토의 정보&quot;로 씁니다.
          </p>
          <input
            value={pinSearch}
            onChange={e => setPinSearch(e.target.value)}
            placeholder="핀·태그 검색…"
            style={{ width: '100%', maxWidth: 360, padding: 8, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 12 }}
          />
          <div
            style={{
              padding: 16,
              borderRadius: 14,
              border: '1px solid rgba(0,0,0,0.06)',
              background: '#f8fafc',
              marginBottom: 20,
            }}
          >
            <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 800, color: '#475569' }}>Spatial Pin 추가</p>
            <select
              value={pinZone}
              onChange={e => setPinZone(e.target.value as MapZoneId)}
              style={{ width: '100%', padding: 8, marginBottom: 8, borderRadius: 8, border: '1px solid #e2e8f0' }}
            >
              {MAP_ZONES.map(z => (
                <option key={z.id} value={z.id}>
                  {z.emoji} {z.label}
                </option>
              ))}
            </select>
            <input
              value={pinTitle}
              onChange={e => setPinTitle(e.target.value)}
              placeholder="제목 (예: 사우디 리서치 메모)"
              style={{ width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 8 }}
            />
            <textarea
              value={pinBody}
              onChange={e => setPinBody(e.target.value)}
              placeholder="본문 (노트)"
              rows={3}
              style={{ width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 8 }}
            />
            <input
              value={pinTheme}
              onChange={e => setPinTheme(e.target.value)}
              placeholder="영토·테마 태그 (예: 사우디아라비아, OPEC — 쉼표 구분)"
              style={{ width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 8, border: '1px solid #c7d2fe', marginBottom: 8 }}
            />
            <select
              value={pinLoot}
              onChange={e => setPinLoot(e.target.value)}
              style={{ width: '100%', padding: 8, marginBottom: 8, borderRadius: 8, border: '1px solid #e2e8f0' }}
            >
              <option value="">연결 전리품 (선택)</option>
              {treasury.map(t => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <button type="button" onClick={addPin} style={btnPrimary}>
              핀 저장
            </button>
          </div>

          <h3 style={{ fontSize: 14, color: '#334155' }}>구역별 핀</h3>
          {MAP_ZONES.map(z => {
            const q = pinSearch.trim().toLowerCase()
            const list = (pinsByZone.get(z.id) ?? []).filter(p => {
              if (!q) return true
              const blob = `${p.title} ${p.body} ${(p.themeTags ?? []).join(' ')}`.toLowerCase()
              return blob.includes(q)
            })
            if (list.length === 0) return null
            return (
              <div key={z.id} style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 800, color: '#475569' }}>
                  {z.emoji} {z.label}
                </p>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {list.map(p => (
                    <li key={p.id} style={{ marginBottom: 8, fontSize: 13, color: '#334155' }}>
                      <strong>{p.title}</strong>
                      {(p.themeTags ?? []).length > 0 && (
                        <span style={{ marginLeft: 6, fontSize: 10, color: '#6366f1' }}>
                          [{(p.themeTags ?? []).join(' · ')}]
                        </span>
                      )}{' '}
                      — {p.body.slice(0, 120)}
                      {p.body.length > 120 ? '…' : ''}
                      <button
                        type="button"
                        onClick={() => removePin(p.id)}
                        style={{ marginLeft: 8, border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 11 }}
                      >
                        삭제
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}

          <h3 style={{ fontSize: 14, color: '#334155', marginTop: 24 }}>지식 루트 (PDF·영상·링크)</h3>
          <ul style={{ fontSize: 13, color: '#475569' }}>
            {knowledgeLoot.map(k => (
              <li key={k.id} style={{ marginBottom: 6 }}>
                <a href={k.url} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>
                  [{KIND_LABEL[k.kind]}] {k.title}
                </a>
              </li>
            ))}
          </ul>
          {knowledgeLoot.length === 0 && <p style={{ color: '#94a3b8', fontSize: 12 }}>Treasury에 PDF·YouTube·링크를 추가해 보세요.</p>}
        </div>
      )}
    </div>
  )
}

const btnPrimary: CSSProperties = {
  padding: '10px 18px',
  borderRadius: 10,
  border: 'none',
  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
  color: '#fff',
  fontWeight: 800,
  fontSize: 13,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
}
