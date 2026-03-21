/**
 * Manifestation 메뉴 확장 — 확언·비전보드·자서전·트랜서핑·미래 인스타 등
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, Trash2, Image as ImageIcon, LayoutGrid, List, Wind } from 'lucide-react'
import {
  loadManifestStudio,
  saveManifestStudio,
  newStudioId,
  type ManifestStudioBundle,
  type StudioTextItem,
  type VisionBoard,
  type FutureInstaPost,
  type BranchScenario,
  type OthersLifeEntry,
  type EffortCard,
  type NegativeRipplePair,
} from './manifestationStudioData'

const cardWrap: React.CSSProperties = {
  background: '#fff',
  borderRadius: 16,
  border: '1px solid rgba(0,0,0,0.06)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  marginBottom: 20,
  overflow: 'hidden',
}
const headPad: React.CSSProperties = { padding: '16px 18px', borderBottom: '1px solid rgba(0,0,0,0.06)' }
const bodyPad: React.CSSProperties = { padding: '14px 18px 18px' }
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#787774', marginBottom: 6 }
const inp: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid rgba(0,0,0,0.1)',
  fontSize: 14,
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}
const btnPrimary: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 12px',
  borderRadius: 10,
  border: 'none',
  background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
  color: '#fff',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
}
const btnGhost: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid rgba(0,0,0,0.1)',
  background: '#fff',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
}

const TOC: { id: string; label: string }[] = [
  { id: 'm-affirm', label: '확언' },
  { id: 'm-vision', label: '비전보드' },
  { id: 'm-trans', label: '트랜서핑·호흡' },
  { id: 'm-insta', label: '미래 인스타' },
  { id: 'm-bio', label: '자서전' },
  { id: 'm-will', label: '될 일은 된다' },
  { id: 'm-time', label: '때의 차이' },
  { id: 'm-past', label: '과거창조' },
  { id: 'm-meant', label: '이러려고 그랬구나' },
  { id: 'm-rev', label: '역전의 기회' },
  { id: 'm-pay', label: '보담' },
  { id: 'm-branch', label: '다른 시나리오' },
  { id: 'm-feel', label: '느낌 증폭' },
  { id: 'm-other', label: '타인의 삶' },
  { id: 'm-neg', label: '부정 파급' },
  { id: 'm-effort', label: '열심히 얻음/놓침' },
]

function scrollToId(id: string) {
  const el = document.getElementById(id)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function readImageFileAsDataUrl(file: File, maxBytes = 2_600_000): Promise<string | null> {
  return new Promise(resolve => {
    if (file.size > maxBytes) {
      window.alert('이미지는 약 2.5MB 이하로 선택해 주세요.')
      resolve(null)
      return
    }
    const r = new FileReader()
    r.onload = () => resolve(typeof r.result === 'string' ? r.result : null)
    r.onerror = () => resolve(null)
    r.readAsDataURL(file)
  })
}

function TextItemsEditor({
  hint,
  items,
  onChange,
  placeholderTitle = '제목',
  placeholderBody = '내용',
}: {
  hint?: string
  items: StudioTextItem[]
  onChange: (next: StudioTextItem[]) => void
  placeholderTitle?: string
  placeholderBody?: string
}) {
  const update = (id: string, patch: Partial<StudioTextItem>) => {
    onChange(items.map(x => (x.id === id ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x)))
  }
  const add = () => {
    const t = new Date().toISOString()
    onChange([...items, { id: newStudioId(), title: '', body: '', updatedAt: t }])
  }
  const remove = (id: string) => {
    if (!window.confirm('이 항목을 삭제할까요?')) return
    onChange(items.filter(x => x.id !== id))
  }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: 13, color: '#787774' }}>{hint}</p>
        <button type="button" onClick={add} style={btnPrimary}>
          <Plus size={14} /> 추가
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.length === 0 && <p style={{ margin: 0, fontSize: 13, color: '#AEAAA4', fontStyle: 'italic' }}>아직 항목이 없습니다.</p>}
        {items.map(row => (
          <div
            key={row.id}
            style={{
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 12,
              padding: 12,
              background: '#fafafa',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button type="button" title="삭제" onClick={() => remove(row.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4 }}>
                <Trash2 size={16} color="#9ca3af" />
              </button>
            </div>
            <label style={lbl}>{placeholderTitle}</label>
            <input value={row.title} onChange={e => update(row.id, { title: e.target.value })} style={inp} placeholder={placeholderTitle} />
            <label style={{ ...lbl, marginTop: 10 }}>본문</label>
            <textarea
              value={row.body}
              onChange={e => update(row.id, { body: e.target.value })}
              style={{ ...inp, minHeight: 100, resize: 'vertical' }}
              placeholder={placeholderBody}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function BreathingGuide() {
  const [phase, setPhase] = useState(0)
  const [running, setRunning] = useState(false)
  const tRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (tRef.current) clearInterval(tRef.current)
    }
  }, [])

  const start = () => {
    if (running) {
      setRunning(false)
      if (tRef.current) clearInterval(tRef.current)
      return
    }
    setRunning(true)
    setPhase(0)
    let p = 0
    tRef.current = setInterval(() => {
      p = (p + 1) % 4
      setPhase(p)
    }, 4000)
  }

  const labels = ['들이마시기 (4)', '참기 (4)', '내쉬기 (6·8)', '쉼']
  return (
    <div
      style={{
        marginTop: 14,
        padding: 16,
        borderRadius: 12,
        background: 'linear-gradient(145deg, rgba(99,102,241,0.08), rgba(139,92,246,0.06))',
        border: '1px solid rgba(99,102,241,0.2)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Wind size={20} color="#6366f1" />
        <span style={{ fontWeight: 800, color: '#37352F' }}>짧은 호흡 가이드 (4초 단위 전환)</span>
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#57534e', lineHeight: 1.55 }}>
        트랜서핑·숏폼 장면을 떠올린 뒤, 가슴이 가라앉을 때까지 천천히 호흡해 보세요. 타이머는 리듬 참고용입니다.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <button type="button" onClick={start} style={{ ...btnPrimary, background: running ? '#64748b' : btnPrimary.background as string }}>
          {running ? '정지' : '시작'}
        </button>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: running
              ? `hsl(${250 + phase * 25}, 70%, ${88 - phase * 3}%)`
              : '#e7e5e4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 800,
            color: '#44403c',
            transition: 'background 0.6s ease',
            boxShadow: running ? '0 0 0 6px rgba(99,102,241,0.15)' : 'none',
          }}
        >
          {running ? labels[phase] : '대기'}
        </div>
      </div>
    </div>
  )
}

export function ManifestationStudio() {
  const [bundle, setBundle] = useState<ManifestStudioBundle>(() => loadManifestStudio())
  const [effortView, setEffortView] = useState<'gallery' | 'list'>('gallery')

  const patch = useCallback((fn: (b: ManifestStudioBundle) => ManifestStudioBundle) => {
    setBundle(prev => {
      const next = fn(prev)
      saveManifestStudio(next)
      return next
    })
  }, [])

  return (
    <div style={{ marginTop: 36, paddingTop: 28, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#37352F' }}>Manifestation 스튜디오</h2>
        <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>확언 · 비전 · 자서전 · 기록</span>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: '#787774', lineHeight: 1.6 }}>
        아래는 인과 보드와 별도로 저장되는 영역입니다. 이미지는 URL 또는 기기에서 불러오기(로컬 data URL)를 지원합니다.
      </p>

      <nav
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 24,
          padding: 12,
          background: '#fafafa',
          borderRadius: 12,
          border: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        {TOC.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => scrollToId(t.id)}
            style={{
              padding: '6px 10px',
              borderRadius: 999,
              border: '1px solid rgba(0,0,0,0.08)',
              background: '#fff',
              fontSize: 11,
              fontWeight: 700,
              color: '#4b5563',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* 확언 */}
      <section id="m-affirm" style={cardWrap}>
        <div style={headPad}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#37352F' }}>확언 목록</h3>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#787774' }}>매일 읽고 싶은 문장을 모아 두세요.</p>
        </div>
        <div style={bodyPad}>
          <TextItemsEditor
            items={bundle.affirmations}
            onChange={next => patch(b => ({ ...b, affirmations: next }))}
            placeholderTitle="한 줄 요약 (선택)"
            placeholderBody="나는 … (확언 전문)"
          />
        </div>
      </section>

      {/* 비전보드 */}
      <section id="m-vision" style={cardWrap}>
        <div style={headPad}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#37352F' }}>비전보드</h3>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#787774' }}>
            보드별로 원하는 이미지를 붙이세요. URL 붙여넣기 또는 이미지 파일을 가져올 수 있습니다.
          </p>
        </div>
        <div style={bodyPad}>
          <button
            type="button"
            onClick={() =>
              patch(b => ({
                ...b,
                visionBoards: [
                  ...b.visionBoards,
                  { id: newStudioId(), title: '새 보드', items: [], updatedAt: new Date().toISOString() },
                ],
              }))
            }
            style={{ ...btnPrimary, marginBottom: 16 }}
          >
            <Plus size={14} /> 보드 추가
          </button>
          {bundle.visionBoards.length === 0 && (
            <p style={{ margin: 0, fontSize: 13, color: '#AEAAA4', fontStyle: 'italic' }}>비전보드가 없습니다.</p>
          )}
          {bundle.visionBoards.map(board => (
            <VisionBoardCard key={board.id} board={board} onChange={next => patch(b => ({ ...b, visionBoards: b.visionBoards.map(v => (v.id === board.id ? next : v)) }))} onRemove={() => patch(b => ({ ...b, visionBoards: b.visionBoards.filter(v => v.id !== board.id) }))} />
          ))}
        </div>
      </section>

      {/* 트랜서핑 */}
      <section id="m-trans" style={cardWrap}>
        <div style={headPad}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#37352F' }}>트랜서핑 숏폼 · 장면 속 호흡</h3>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#787774' }}>원하는 장면을 짧게 적고, 아래 호흡으로 몸을 맞춥니다.</p>
        </div>
        <div style={bodyPad}>
          <label style={lbl}>장면 / 느낌 메모</label>
          <textarea
            value={bundle.transurfingScene}
            onChange={e => patch(b => ({ ...b, transurfingScene: e.target.value }))}
            style={{ ...inp, minHeight: 120, resize: 'vertical' }}
            placeholder="예: 이미 이룬 나의 하루, 특정 장소에서의 평온함…"
          />
          <BreathingGuide />
        </div>
      </section>

      {/* 미래 인스타 */}
      <section id="m-insta" style={cardWrap}>
        <div style={headPad}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#37352F' }}>미래 인스타 피드</h3>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#787774' }}>미래의 나의 게시물처럼 캡션·이미지를 쌓아 보세요.</p>
        </div>
        <div style={bodyPad}>
          <button
            type="button"
            onClick={() =>
              patch(b => ({
                ...b,
                futureInsta: [
                  ...b.futureInsta,
                  {
                    id: newStudioId(),
                    caption: '',
                    sortOrder: b.futureInsta.length,
                    updatedAt: new Date().toISOString(),
                  },
                ],
              }))
            }
            style={{ ...btnPrimary, marginBottom: 16 }}
          >
            <Plus size={14} /> 포스트 추가
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {bundle.futureInsta.map(post => (
              <FutureInstaCard key={post.id} post={post} onChange={next => patch(b => ({ ...b, futureInsta: b.futureInsta.map(p => (p.id === post.id ? next : p)) }))} onRemove={() => patch(b => ({ ...b, futureInsta: b.futureInsta.filter(p => p.id !== post.id) }))} />
            ))}
          </div>
          {bundle.futureInsta.length === 0 && (
            <p style={{ margin: 0, fontSize: 13, color: '#AEAAA4', fontStyle: 'italic' }}>포스트가 없습니다.</p>
          )}
        </div>
      </section>

      {/* 자서전 */}
      <section id="m-bio" style={cardWrap}>
        <div style={headPad}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#37352F' }}>자서전</h3>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#787774' }}>일반적인 자서전 흐름에 맞춰 섹션별로 작성할 수 있습니다.</p>
        </div>
        <div style={bodyPad}>
          <AutobiographyForm bio={bundle.autobiography} onChange={next => patch(b => ({ ...b, autobiography: next }))} />
        </div>
      </section>

      {/* 될 일은 된다 */}
      <section id="m-will" style={cardWrap}>
        <div style={headPad}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#37352F' }}>될 일은 된다</h3>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#787774' }}>
            정말 될까 불안했지만 결국 이뤄졌던 일, 나를 지나온 증거로 남기세요.
          </p>
        </div>
        <div style={bodyPad}>
          <TextItemsEditor
            items={bundle.willComeTrue}
            onChange={next => patch(b => ({ ...b, willComeTrue: next }))}
            placeholderTitle="한 줄 요약"
            placeholderBody="그때 어떤 마음이었고, 어떻게 이뤄졌는지…"
          />
        </div>
      </section>

      {/* 때의 차이 */}
      <section id="m-time" style={cardWrap}>
        <div style={headPad}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#37352F' }}>때의 차이</h3>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#787774' }}>사람마다 성공의 시기가 다르다는 걸 떠올리게 하는 스토리·메모.</p>
        </div>
        <div style={bodyPad}>
          <TextItemsEditor
            items={bundle.timingOfSuccess}
            onChange={next => patch(b => ({ ...b, timingOfSuccess: next }))}
            placeholderTitle="예: 짱구 작가, 맥도날드 창업자…"
            placeholderBody="나이·시기·느낌·교훈"
          />
        </div>
      </section>

      {/* 과거창조 */}
      <section id="m-past" style={cardWrap}>
        <div style={headPad}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#37352F' }}>과거창조</h3>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#787774' }}>과거 사건의 의미를 내가 앞으로 만들어가는 서사로 재구성합니다.</p>
        </div>
        <div style={bodyPad}>
          <TextItemsEditor
            items={bundle.pastReconstruction}
            onChange={next => patch(b => ({ ...b, pastReconstruction: next }))}
            placeholderTitle="한 줄 요약"
            placeholderBody="예: 공모전 10번 실패… 지금 성공한 나에게는 그때가 반드시 필요했던 연습이었다"
          />
        </div>
      </section>

      {/* 이러려고 그랬구나 */}
      <section id="m-meant" style={cardWrap}>
        <div style={headPad}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#37352F' }}>이러려고 그랬구나</h3>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#787774' }}>A가 안 풀린 것이 B가 잘 되기 위한 배치였다는 식의 재해석.</p>
        </div>
        <div style={bodyPad}>
          <TextItemsEditor
            items={bundle.meantForThis}
            onChange={next => patch(b => ({ ...b, meantForThis: next }))}
            placeholderTitle="한 줄 요약"
            placeholderBody="A가 안 됐지만 … 덕분에 B가 됐다"
          />
        </div>
      </section>

      {/* 역전의 기회 */}
      <section id="m-rev" style={cardWrap}>
        <div style={headPad}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#37352F' }}>역전의 기회는 있었다</h3>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#787774' }}>역사적·개인적 자산·계층 상승 기회 등, 비슷한 상황에 대비할 매뉴얼.</p>
        </div>
        <div style={bodyPad}>
          <TextItemsEditor
            items={bundle.reversalOpportunities}
            onChange={next => patch(b => ({ ...b, reversalOpportunities: next }))}
            placeholderTitle="시기·상황"
            placeholderBody="내용·다음에 할 행동"
          />
        </div>
      </section>

      {/* 보담 */}
      <section id="m-pay" style={cardWrap}>
        <div style={headPad}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#37352F' }}>사람들에게 보담</h3>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#787774' }}>일찍 믿어준 사람에게, 혹은 비판이 나를 키웠다며 감사를 남기는 글.</p>
        </div>
        <div style={bodyPad}>
          <TextItemsEditor
            items={bundle.repayingPeople}
            onChange={next => patch(b => ({ ...b, repayingPeople: next }))}
            placeholderTitle="대상 / 상황"
            placeholderBody="보답·감사·화해의 말"
          />
        </div>
      </section>

      {/* 다른 시나리오 */}
      <section id="m-branch" style={cardWrap}>
        <div style={headPad}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#37352F' }}>다른 시나리오가 될 수 있었다</h3>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#787774' }}>분기점과, 달랐다면 어땠을지 짝지어 적습니다.</p>
        </div>
        <div style={bodyPad}>
          <BranchScenarioEditor items={bundle.branchScenarios} onChange={next => patch(b => ({ ...b, branchScenarios: next }))} />
        </div>
      </section>

      {/* 느낌 증폭 */}
      <section id="m-feel" style={cardWrap}>
        <div style={headPad}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#37352F' }}>느낌 주파수 증폭</h3>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#787774' }}>성공의 느낌 글 잘 쓴다고 들었을 때 등, 몸에 남는 좋은 느낌을 메모.</p>
        </div>
        <div style={bodyPad}>
          <TextItemsEditor
            items={bundle.feelingAmplify}
            onChange={next => patch(b => ({ ...b, feelingAmplify: next }))}
            placeholderTitle="느낌 / 상황"
            placeholderBody="그 순간을 떠올리며…"
          />
        </div>
      </section>

      {/* 타인의 삶 */}
      <section id="m-other" style={cardWrap}>
        <div style={headPad}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#37352F' }}>타인의 삶</h3>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#787774' }}>태그는 쉼표로 구분합니다. 예: 타인의삶, 도전</p>
        </div>
        <div style={bodyPad}>
          <OthersLivesEditor items={bundle.othersLives} onChange={next => patch(b => ({ ...b, othersLives: next }))} />
        </div>
      </section>

      {/* 부정 파급 */}
      <section id="m-neg" style={cardWrap}>
        <div style={headPad}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#991b1b' }}>부정적 파급효과</h3>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#787774' }}>위 인과 보드의 <strong>반대 테마</strong>입니다. 부정적 행동 → 부정적 결과를 짝지어 봅니다.</p>
        </div>
        <div style={bodyPad}>
          <NegativeRippleEditor items={bundle.negativeRipple} onChange={next => patch(b => ({ ...b, negativeRipple: next }))} />
        </div>
      </section>

      {/* 열심히 */}
      <section id="m-effort" style={cardWrap}>
        <div style={{ ...headPad, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#37352F' }}>열심히 해서 얻은 것 · 놓치거나 잃은 것</h3>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#787774' }}>갤러리 또는 리스트로 볼 수 있습니다.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setEffortView('gallery')}
              style={{ ...btnGhost, borderColor: effortView === 'gallery' ? '#6366f1' : undefined, color: effortView === 'gallery' ? '#4f46e5' : '#57534e' }}
            >
              <LayoutGrid size={14} style={{ verticalAlign: 'middle' }} /> 갤러리
            </button>
            <button
              type="button"
              onClick={() => setEffortView('list')}
              style={{ ...btnGhost, borderColor: effortView === 'list' ? '#6366f1' : undefined, color: effortView === 'list' ? '#4f46e5' : '#57534e' }}
            >
              <List size={14} style={{ verticalAlign: 'middle' }} /> 리스트
            </button>
          </div>
        </div>
        <div style={bodyPad}>
          <EffortSplit
            gained={bundle.effortGained}
            missed={bundle.effortMissed}
            view={effortView}
            onChangeGained={next => patch(b => ({ ...b, effortGained: next }))}
            onChangeMissed={next => patch(b => ({ ...b, effortMissed: next }))}
          />
        </div>
      </section>
    </div>
  )
}

function VisionBoardCard({
  board,
  onChange,
  onRemove,
}: {
  board: VisionBoard
  onChange: (b: VisionBoard) => void
  onRemove: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [urlDraft, setUrlDraft] = useState('')

  const addUrl = () => {
    const u = urlDraft.trim()
    if (!u) return
    onChange({
      ...board,
      updatedAt: new Date().toISOString(),
      items: [...board.items, { id: newStudioId(), imageUrl: u, caption: '' }],
    })
    setUrlDraft('')
  }

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !f.type.startsWith('image/')) return
    const dataUrl = await readImageFileAsDataUrl(f)
    if (!dataUrl) return
    onChange({
      ...board,
      updatedAt: new Date().toISOString(),
      items: [...board.items, { id: newStudioId(), imageUrl: dataUrl, caption: '' }],
    })
  }

  return (
    <div style={{ marginBottom: 20, border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14, padding: 14, background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <input
          value={board.title}
          onChange={e => onChange({ ...board, title: e.target.value, updatedAt: new Date().toISOString() })}
          style={{ ...inp, flex: '1 1 200px', fontWeight: 800 }}
          placeholder="보드 제목"
        />
        <button type="button" onClick={() => window.confirm('이 보드를 삭제할까요?') && onRemove()} style={btnGhost}>
          <Trash2 size={14} /> 보드 삭제
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <input value={urlDraft} onChange={e => setUrlDraft(e.target.value)} style={{ ...inp, flex: '1 1 200px' }} placeholder="이미지 URL" />
        <button type="button" onClick={addUrl} style={btnPrimary}>
          URL 추가
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} style={btnGhost}>
          <ImageIcon size={14} /> 파일에서
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => void onPickFile(e)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
        {board.items.map(img => (
          <div key={img.id} style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, overflow: 'hidden', background: '#fafafa' }}>
            <div style={{ aspectRatio: '1', position: 'relative', background: '#e7e5e4' }}>
              <img src={img.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...board,
                    updatedAt: new Date().toISOString(),
                    items: board.items.filter(i => i.id !== img.id),
                  })
                }
                style={{ position: 'absolute', top: 4, right: 4, border: 'none', background: 'rgba(255,255,255,0.9)', borderRadius: 6, padding: 4, cursor: 'pointer' }}
              >
                <Trash2 size={12} />
              </button>
            </div>
            <input
              value={img.caption ?? ''}
              onChange={e =>
                onChange({
                  ...board,
                  updatedAt: new Date().toISOString(),
                  items: board.items.map(i => (i.id === img.id ? { ...i, caption: e.target.value } : i)),
                })
              }
              style={{ ...inp, border: 'none', fontSize: 12, padding: 8 }}
              placeholder="캡션"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function FutureInstaCard({
  post,
  onChange,
  onRemove,
}: {
  post: FutureInstaPost
  onChange: (p: FutureInstaPost) => void
  onRemove: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !f.type.startsWith('image/')) return
    const dataUrl = await readImageFileAsDataUrl(f)
    if (!dataUrl) return
    onChange({ ...post, imageUrl: dataUrl, updatedAt: new Date().toISOString() })
  }
  return (
    <div style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
      <div style={{ aspectRatio: '1', background: '#f5f5f4', position: 'relative' }}>
        {post.imageUrl ? (
          <img src={post.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a8a29e', fontSize: 12 }}>이미지 없음</div>
        )}
        <button
          type="button"
          onClick={() => onRemove()}
          style={{ position: 'absolute', top: 6, right: 6, border: 'none', background: 'rgba(255,255,255,0.92)', borderRadius: 8, padding: 6, cursor: 'pointer' }}
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div style={{ padding: 10 }}>
        <textarea
          value={post.caption}
          onChange={e => onChange({ ...post, caption: e.target.value, updatedAt: new Date().toISOString() })}
          style={{ ...inp, minHeight: 72, fontSize: 13 }}
          placeholder="캡션 #해시태그"
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button type="button" onClick={() => fileRef.current?.click()} style={{ ...btnGhost, fontSize: 11 }}>
            이미지
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => void onPick(e)} />
        </div>
      </div>
    </div>
  )
}

function AutobiographyForm({
  bio,
  onChange,
}: {
  bio: ManifestStudioBundle['autobiography']
  onChange: (b: ManifestStudioBundle['autobiography']) => void
}) {
  const field = (key: keyof ManifestStudioBundle['autobiography'], label: string, hint: string) => (
    <div style={{ marginBottom: 14 }}>
      <label style={lbl}>{label}</label>
      <p style={{ margin: '0 0 6px', fontSize: 11, color: '#a8a29e' }}>{hint}</p>
      <textarea
        value={bio[key] as string}
        onChange={e => onChange({ ...bio, [key]: e.target.value })}
        style={{ ...inp, minHeight: key === 'bookTitle' || key === 'subtitle' ? 56 : 100, resize: 'vertical' }}
      />
    </div>
  )
  return (
    <div>
      {field('bookTitle', '자서전 제목', '예: 나의 이름으로')}
      {field('subtitle', '부제 / 한 줄 소개', '')}
      {field('birthAndFamily', '출생과 가족', '태어난 환경, 가족 이야기의 시작')}
      {field('childhood', '유년·학년', '기억에 남는 장면')}
      {field('educationAndGrowth', '교육과 성장', '배움·학교·스승')}
      {field('careerAndWork', '직업과 일', '일을 통해 만난 세계')}
      {field('relationships', '관계', '사랑·우정·멘토')}
      {field('hardshipsAndOvercoming', '시련과 극복', '흔들렸던 순간과 버틴 힘')}
      {field('turningPoints', '전환점', '삶이 바뀐 선택들')}
      {field('beliefsAndValues', '신념과 가치', '지금까지 지키고 싶은 것')}
      {field('todayAndFuture', '오늘과 앞으로', '현재의 나, 그리고 그리는 미래')}
      {field('legacy', '남기고 싶은 것', '말·작품·영향')}
      {field('freeNotes', '자유 메모', '위 형식에 안 맞는 이야기')}
    </div>
  )
}

function BranchScenarioEditor({
  items,
  onChange,
}: {
  items: BranchScenario[]
  onChange: (next: BranchScenario[]) => void
}) {
  const add = () => {
    const t = new Date().toISOString()
    onChange([...items, { id: newStudioId(), moment: '', alternateOutcome: '', updatedAt: t }])
  }
  const upd = (id: string, patch: Partial<BranchScenario>) => {
    onChange(items.map(x => (x.id === id ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x)))
  }
  const remove = (id: string) => {
    if (!window.confirm('삭제할까요?')) return
    onChange(items.filter(x => x.id !== id))
  }
  return (
    <>
      <button type="button" onClick={add} style={{ ...btnPrimary, marginBottom: 16 }}>
        <Plus size={14} /> 분기 추가
      </button>
      {items.length === 0 && <p style={{ color: '#AEAAA4', fontStyle: 'italic' }}>기록이 없습니다.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {items.map(row => (
          <div key={row.id} style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: 12, background: '#fafafa' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button type="button" onClick={() => remove(row.id)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <Trash2 size={16} color="#9ca3af" />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div>
                <label style={lbl}>분기점 순간</label>
                <textarea value={row.moment} onChange={e => upd(row.id, { moment: e.target.value })} style={{ ...inp, minHeight: 100 }} placeholder="그때의 선택·상황" />
              </div>
              <div>
                <label style={lbl}>달랐다면 / 다른 시나리오</label>
                <textarea value={row.alternateOutcome} onChange={e => upd(row.id, { alternateOutcome: e.target.value })} style={{ ...inp, minHeight: 100 }} placeholder="지금과는 어떻게 달랐을지" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function OthersLivesEditor({
  items,
  onChange,
}: {
  items: OthersLifeEntry[]
  onChange: (next: OthersLifeEntry[]) => void
}) {
  const add = () => {
    const t = new Date().toISOString()
    onChange([...items, { id: newStudioId(), tags: [], title: '', body: '', updatedAt: t }])
  }
  const upd = (id: string, patch: Partial<OthersLifeEntry>) => {
    onChange(items.map(x => (x.id === id ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x)))
  }
  const remove = (id: string) => {
    if (!window.confirm('삭제할까요?')) return
    onChange(items.filter(x => x.id !== id))
  }
  return (
    <>
      <button type="button" onClick={add} style={{ ...btnPrimary, marginBottom: 16 }}>
        <Plus size={14} /> 항목 추가
      </button>
      {items.length === 0 && <p style={{ color: '#AEAAA4', fontStyle: 'italic' }}>기록이 없습니다.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {items.map(row => (
          <div key={row.id} style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: 12, background: '#fafafa' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button type="button" onClick={() => remove(row.id)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <Trash2 size={16} color="#9ca3af" />
              </button>
            </div>
            <label style={lbl}>태그 (쉼표로 구분)</label>
            <input
              value={row.tags.join(', ')}
              onChange={e =>
                upd(row.id, {
                  tags: e.target.value
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean),
                })
              }
              style={inp}
              placeholder="타인의삶, 도전, 이건희"
            />
            <label style={{ ...lbl, marginTop: 10 }}>제목</label>
            <input value={row.title} onChange={e => upd(row.id, { title: e.target.value })} style={inp} placeholder="예: 반도체 사업 도전" />
            <label style={{ ...lbl, marginTop: 10 }}>본문</label>
            <textarea value={row.body} onChange={e => upd(row.id, { body: e.target.value })} style={{ ...inp, minHeight: 100 }} placeholder="배울 점·용기를 준 이유" />
          </div>
        ))}
      </div>
    </>
  )
}

function NegativeRippleEditor({
  items,
  onChange,
}: {
  items: NegativeRipplePair[]
  onChange: (next: NegativeRipplePair[]) => void
}) {
  const add = () => {
    const t = new Date().toISOString()
    onChange([...items, { id: newStudioId(), badAction: '', badOutcome: '', updatedAt: t }])
  }
  const upd = (id: string, patch: Partial<NegativeRipplePair>) => {
    onChange(items.map(x => (x.id === id ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x)))
  }
  const remove = (id: string) => {
    if (!window.confirm('삭제할까요?')) return
    onChange(items.filter(x => x.id !== id))
  }
  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          marginBottom: 10,
          fontSize: 12,
          fontWeight: 800,
          color: '#991b1b',
        }}
      >
        <span>부정적 원인 · 행동</span>
        <span>부정적 결과 · 파급</span>
      </div>
      <button type="button" onClick={add} style={{ ...btnPrimary, marginBottom: 16, background: 'linear-gradient(135deg,#b91c1c,#991b1b)' }}>
        <Plus size={14} /> 행 추가
      </button>
      {items.length === 0 && <p style={{ color: '#AEAAA4', fontStyle: 'italic' }}>기록이 없습니다.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map(row => (
          <div key={row.id} style={{ border: '1px solid rgba(185,28,28,0.25)', borderRadius: 12, padding: 12, background: '#fff7f7' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button type="button" onClick={() => remove(row.id)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <Trash2 size={16} color="#9ca3af" />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div>
                <label style={lbl}>부정적 행동</label>
                <textarea value={row.badAction} onChange={e => upd(row.id, { badAction: e.target.value })} style={{ ...inp, minHeight: 88 }} placeholder="미룸, 과소비, 독설…" />
              </div>
              <div>
                <label style={lbl}>부정적 결과</label>
                <textarea value={row.badOutcome} onChange={e => upd(row.id, { badOutcome: e.target.value })} style={{ ...inp, minHeight: 88 }} placeholder="기회 상실, 관계 악화…" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function EffortSplit({
  gained,
  missed,
  view,
  onChangeGained,
  onChangeMissed,
}: {
  gained: EffortCard[]
  missed: EffortCard[]
  view: 'gallery' | 'list'
  onChangeGained: (next: EffortCard[]) => void
  onChangeMissed: (next: EffortCard[]) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 20 }}>
      <div>
        <h4 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 900, color: '#059669' }}>열심히 해서 얻은 것</h4>
        <EffortCards items={gained} view={view} accent="#059669" onChange={onChangeGained} />
      </div>
      <div>
        <h4 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 900, color: '#b45309' }}>열심히 하지 않아서 놓치거나 잃은 것</h4>
        <EffortCards items={missed} view={view} accent="#b45309" onChange={onChangeMissed} />
      </div>
    </div>
  )
}

function EffortCards({
  items,
  view,
  accent,
  onChange,
}: {
  items: EffortCard[]
  view: 'gallery' | 'list'
  accent: string
  onChange: (next: EffortCard[]) => void
}) {
  const add = () => {
    const t = new Date().toISOString()
    onChange([...items, { id: newStudioId(), title: '', body: '', updatedAt: t }])
  }
  const upd = (id: string, patch: Partial<EffortCard>) => {
    onChange(items.map(x => (x.id === id ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x)))
  }
  const remove = (id: string) => {
    if (!window.confirm('삭제할까요?')) return
    onChange(items.filter(x => x.id !== id))
  }

  const pickImage = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !f.type.startsWith('image/')) return
    const dataUrl = await readImageFileAsDataUrl(f)
    if (!dataUrl) return
    upd(id, { imageUrl: dataUrl })
  }

  return (
    <>
      <button type="button" onClick={add} style={{ ...btnPrimary, marginBottom: 12, background: accent }}>
        <Plus size={14} /> 카드 추가
      </button>
      {items.length === 0 && <p style={{ color: '#AEAAA4', fontStyle: 'italic', fontSize: 13 }}>없습니다.</p>}
      <div
        style={
          view === 'gallery'
            ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }
            : { display: 'flex', flexDirection: 'column', gap: 12 }
        }
      >
        {items.map(card => (
          <div
            key={card.id}
            style={{
              border: `1px solid ${accent}33`,
              borderRadius: 12,
              overflow: 'hidden',
              background: '#fff',
              display: 'flex',
              flexDirection: view === 'list' ? 'row' : 'column',
            }}
          >
            {card.imageUrl && (
              <div style={{ width: view === 'list' ? 120 : '100%', flexShrink: 0, aspectRatio: view === 'list' ? undefined : '4/3', background: '#f5f5f4' }}>
                <img src={card.imageUrl} alt="" style={{ width: '100%', height: view === 'list' ? '100%' : '100%', objectFit: 'cover', minHeight: view === 'list' ? 100 : undefined }} />
              </div>
            )}
            <div style={{ padding: 10, flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginBottom: 6 }}>
                <label style={{ cursor: 'pointer', fontSize: 11, color: accent, fontWeight: 700 }}>
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => void pickImage(card.id, e)} />
                  이미지
                </label>
                <button type="button" onClick={() => remove(card.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
                  <Trash2 size={14} color="#9ca3af" />
                </button>
              </div>
              <input value={card.title} onChange={e => upd(card.id, { title: e.target.value })} style={{ ...inp, marginBottom: 8, fontWeight: 700 }} placeholder="제목" />
              <textarea value={card.body} onChange={e => upd(card.id, { body: e.target.value })} style={{ ...inp, minHeight: 72, fontSize: 13 }} placeholder="설명" />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
