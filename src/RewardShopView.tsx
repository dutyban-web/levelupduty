/**
 * 비밀 상점 — 골드 소모 + 크레딧(EXP) 상점 + 심상화 거래
 */
import { useEffect, useMemo, useState } from 'react'
import { loadRpgProfile } from './levelupRpgProfile'
import { trySpendGold } from './kingdomData'
import { BL_RPG_SYNC } from './questRpgIntegration'
import { appendRewardHistory } from './rewardHistoryData'
import {
  SHOP_CATALOG,
  CREDIT_SHOP_ITEMS,
  CREDIT_SHOP_CATEGORY_LABEL,
  addVisualizationItem,
  deleteVisualizationItem,
  loadVisualizationItems,
  type CreditShopCategory,
  type VisualizationItem,
} from './rewardShopData'
import { DialogueBox, type DialogueBoxVariant } from './DialogueBox'
import { loadSimulationWallet, spendSimulationCredits } from './simulationWalletData'

type DialogueState =
  | { open: false }
  | { open: true; variant: DialogueBoxVariant; speaker: string; message: string }

function kindForCreditCategory(c: CreditShopCategory): 'consumable' | 'equipment' | 'relic' {
  return c
}

export function RewardShopView() {
  const [gold, setGold] = useState(() => loadRpgProfile().gold)
  const [simCredits, setSimCredits] = useState(() => loadSimulationWallet().credits)
  const [viz, setViz] = useState(loadVisualizationItems)
  const [dialogue, setDialogue] = useState<DialogueState>({ open: false })
  const [draft, setDraft] = useState({ title: '', description: '', costGold: 40 })
  const [creditTab, setCreditTab] = useState<CreditShopCategory>('consumable')
  const [txFlash, setTxFlash] = useState(false)

  useEffect(() => {
    const h = () => setGold(loadRpgProfile().gold)
    window.addEventListener(BL_RPG_SYNC, h)
    return () => window.removeEventListener(BL_RPG_SYNC, h)
  }, [])

  useEffect(() => {
    const h = () => setSimCredits(loadSimulationWallet().credits)
    window.addEventListener('bl-simulation-wallet-sync', h)
    return () => window.removeEventListener('bl-simulation-wallet-sync', h)
  }, [])

  const creditFiltered = useMemo(
    () => CREDIT_SHOP_ITEMS.filter(i => i.category === creditTab),
    [creditTab],
  )

  const runTxFlash = () => {
    setTxFlash(true)
    window.setTimeout(() => setTxFlash(false), 520)
  }

  const buyCatalog = (id: string, title: string, cost: number) => {
    if (!trySpendGold(cost)) {
      window.alert('골드가 부족합니다.')
      return
    }
    appendRewardHistory({ kind: 'shop_item', refId: id, title, costGold: cost })
    setGold(loadRpgProfile().gold)
    runTxFlash()
    setDialogue({
      open: true,
      variant: 'oracle',
      speaker: '【신 · Oracle】',
      message: '거래가 성사되었습니다. 신이 당신의 투자를 지켜봅니다.',
    })
  }

  const buyCredit = (item: (typeof CREDIT_SHOP_ITEMS)[number]) => {
    if (!spendSimulationCredits(item.costCredits)) {
      window.alert('시뮬레이션 크레딧(EXP)이 부족합니다.')
      return
    }
    appendRewardHistory({
      kind: kindForCreditCategory(item.category),
      refId: item.id,
      title: item.title,
      costGold: 0,
      costCredits: item.costCredits,
    })
    setSimCredits(loadSimulationWallet().credits)
    runTxFlash()
    setDialogue({
      open: true,
      variant: 'merchant',
      speaker: '【대장간 상인】',
      message: '훌륭한 보상입니다. 당신의 노력이 결실을 맺었습니다.',
    })
  }

  const buyVisualization = (item: VisualizationItem) => {
    if (!trySpendGold(item.costGold)) {
      window.alert('골드가 부족합니다.')
      return
    }
    appendRewardHistory({
      kind: 'visualization',
      refId: item.id,
      title: item.title,
      costGold: item.costGold,
    })
    setGold(loadRpgProfile().gold)
    runTxFlash()
    setDialogue({
      open: true,
      variant: 'oracle',
      speaker: '【신 · Oracle】',
      message: '거래가 성사되었습니다. 신이 당신의 투자를 지켜봅니다.',
    })
  }

  const registerViz = () => {
    const t = draft.title.trim()
    const d = draft.description.trim()
    if (!t || !d) {
      window.alert('제목과 바라는 미래 상황을 입력해 주세요.')
      return
    }
    setViz(addVisualizationItem({ title: t, description: d, costGold: draft.costGold }))
    setDraft({ title: '', description: '', costGold: 40 })
  }

  const removeViz = (id: string) => {
    if (!window.confirm('이 심상화 항목을 삭제할까요?')) return
    setViz(deleteVisualizationItem(id))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'relative' }}>
      <style>{`
        @keyframes reward-coin-burst {
          0% { opacity: 0; transform: scale(0.4) translateY(8px); }
          35% { opacity: 1; }
          100% { opacity: 0; transform: scale(1.2) translateY(-28px); }
        }
        @keyframes reward-gold-flash {
          0% { opacity: 0.55; }
          100% { opacity: 0; }
        }
      `}</style>

      {txFlash ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9400,
            pointerEvents: 'none',
            background: 'radial-gradient(circle at 50% 40%, rgba(251,191,36,0.35), transparent 55%)',
            animation: 'reward-gold-flash 0.5s ease-out forwards',
          }}
        />
      ) : null}
      {txFlash ? (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            top: '42%',
            zIndex: 9401,
            pointerEvents: 'none',
            transform: 'translate(-50%, -50%)',
            fontSize: 42,
            animation: 'reward-coin-burst 0.55s ease-out forwards',
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
          }}
        >
          🪙✨
        </div>
      ) : null}

      <div
        style={{
          padding: '12px 14px',
          borderRadius: 12,
          background: 'linear-gradient(180deg, #292524 0%, #1c1917 100%)',
          border: '2px solid #7c2d12',
          boxShadow: 'inset 0 0 24px rgba(234,88,12,0.12)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 900, color: '#fde68a', letterSpacing: '0.06em' }}>비밀 상점 · 대장간</span>
        <span style={{ fontSize: 12, color: '#e7e5e4' }}>
          보유 골드 <strong style={{ color: '#fbbf24' }}>{gold} G</strong>
        </span>
        <span
          style={{
            fontSize: 11,
            color: '#a5b4fc',
            padding: '4px 10px',
            borderRadius: 8,
            background: 'linear-gradient(180deg, rgba(67,20,7,0.9), rgba(28,25,23,0.95))',
            border: '1px solid rgba(180,83,9,0.55)',
          }}
          title="퀘스트·시간점수 등으로 얻은 EXP가 적립됩니다"
        >
          시뮬 크레딧 <strong style={{ color: '#fde68a' }}>{simCredits.toLocaleString()}</strong>
        </span>
      </div>

      <div>
        <h3 style={{ margin: '0 0 10px', fontSize: 14, color: '#44403c' }}>정화 상품 (골드)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {SHOP_CATALOG.map(item => (
            <div
              key={item.id}
              style={{
                padding: 12,
                borderRadius: 12,
                background: 'linear-gradient(165deg, #fff7ed, #ffedd5)',
                border: '1px solid rgba(234,88,12,0.35)',
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 4 }}>{item.emoji}</div>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#431407' }}>{item.title}</div>
              <div style={{ fontSize: 11, color: '#7c2d12', marginTop: 4, lineHeight: 1.45 }}>{item.description}</div>
              <button
                type="button"
                onClick={() => buyCatalog(item.id, item.title, item.costGold)}
                style={{
                  marginTop: 10,
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(180deg, #ea580c, #c2410c)',
                  color: '#fff',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                {item.costGold} G 로 구매
              </button>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          padding: 16,
          borderRadius: 14,
          background: 'linear-gradient(180deg, #1c1410 0%, #0c0a09 100%)',
          border: '2px solid #5c4033',
          boxShadow: 'inset 0 0 32px rgba(234,88,12,0.08)',
        }}
      >
        <h3 style={{ margin: '0 0 6px', fontSize: 14, color: '#fde68a', letterSpacing: '0.06em' }}>심상 보물고 (크레딧)</h3>
        <p style={{ margin: '0 0 14px', fontSize: 11, color: '#a8a29e', lineHeight: 1.55 }}>
          시뮬레이션 크레딧으로 거래합니다. 구매 시 금전 연출과 함께 상인의 축하가 이어집니다.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {(['consumable', 'equipment', 'relic'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setCreditTab(tab)}
              style={{
                padding: '8px 14px',
                borderRadius: 999,
                border: creditTab === tab ? '2px solid #fbbf24' : '1px solid #57534e',
                background: creditTab === tab ? 'rgba(251,191,36,0.15)' : 'rgba(0,0,0,0.35)',
                color: creditTab === tab ? '#fef3c7' : '#a8a29e',
                fontWeight: 800,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              {CREDIT_SHOP_CATEGORY_LABEL[tab]}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {creditFiltered.map(item => (
            <div
              key={item.id}
              style={{
                padding: 12,
                borderRadius: 12,
                background: 'linear-gradient(165deg, rgba(28,20,16,0.98), rgba(12,10,9,0.99))',
                border: '1px solid rgba(180,83,9,0.45)',
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 4 }}>{item.emoji}</div>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#fafaf9' }}>{item.title}</div>
              <div style={{ fontSize: 11, color: '#a8a29e', marginTop: 4, lineHeight: 1.45 }}>{item.description}</div>
              <div style={{ fontSize: 10, color: '#fbbf24', marginTop: 6 }}>{item.costCredits.toLocaleString()} 크레딧</div>
              <button
                type="button"
                onClick={() => buyCredit(item)}
                style={{
                  marginTop: 10,
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid #b45309',
                  background: 'linear-gradient(180deg, #92400e, #78350f)',
                  color: '#fffbeb',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                크레딧으로 구매
              </button>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          padding: 14,
          borderRadius: 14,
          background: 'linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%)',
          border: '1px solid rgba(129,140,248,0.4)',
        }}
      >
        <h3 style={{ margin: '0 0 8px', fontSize: 14, color: '#e0e7ff' }}>심상화 거래 — 미래를 아이템으로</h3>
        <p style={{ margin: '0 0 12px', fontSize: 11, color: '#a5b4fc', lineHeight: 1.5 }}>
          원하는 장면을 적고 가격을 매기면 상점 목록에 올라갑니다. 코인을 지불해 &quot;구매&quot;하면 서사적으로 거래가 성사됩니다.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          <input
            placeholder="아이템 제목 (예: 원고 제출 D-1의 나)"
            value={draft.title}
            onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
            style={{ padding: 8, borderRadius: 8, border: '1px solid #4f46e5', fontSize: 12 }}
          />
          <textarea
            placeholder="바라는 미래 상황 (자세히)"
            value={draft.description}
            onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
            rows={3}
            style={{ padding: 8, borderRadius: 8, border: '1px solid #4f46e5', fontSize: 12, resize: 'vertical' }}
          />
          <label style={{ fontSize: 11, color: '#c7d2fe' }}>
            가격 (G){' '}
            <input
              type="number"
              min={1}
              value={draft.costGold}
              onChange={e => setDraft(d => ({ ...d, costGold: parseInt(e.target.value, 10) || 1 }))}
              style={{ width: 80, marginLeft: 8, padding: 4, borderRadius: 6 }}
            />
          </label>
          <button
            type="button"
            onClick={registerViz}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid #818cf8',
              background: 'rgba(99,102,241,0.25)',
              color: '#e0e7ff',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            목록에 올리기
          </button>
        </div>

        <div style={{ fontSize: 12, fontWeight: 800, color: '#fde68a', marginBottom: 8 }}>등록된 심상화</div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {viz.items.map(v => (
            <li
              key={v.id}
              style={{
                padding: 10,
                borderRadius: 10,
                background: 'rgba(15,23,42,0.65)',
                border: '1px solid rgba(129,140,248,0.35)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div>
                <strong style={{ color: '#f8fafc' }}>{v.title}</strong>
                <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 4, whiteSpace: 'pre-wrap' }}>{v.description}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>{v.costGold} G</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => buyVisualization(v)}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'linear-gradient(180deg, #6366f1, #4f46e5)',
                    color: '#fff',
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontSize: 11,
                  }}
                >
                  코인으로 거래 성사
                </button>
                <button
                  type="button"
                  onClick={() => removeViz(v.id)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #fecdd3',
                    background: 'transparent',
                    color: '#fda4af',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
          {viz.items.length === 0 ? <li style={{ fontSize: 11, color: '#64748b' }}>등록된 심상화가 없습니다.</li> : null}
        </ul>
      </div>

      <DialogueBox
        open={dialogue.open}
        variant={dialogue.open ? dialogue.variant : 'oracle'}
        speaker={dialogue.open ? dialogue.speaker : ''}
        onDismiss={() => setDialogue({ open: false })}
      >
        {dialogue.open ? dialogue.message : null}
      </DialogueBox>
    </div>
  )
}
