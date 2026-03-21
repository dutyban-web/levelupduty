/**
 * Network 목록·상세 공통 — 인간관계론(전역 매뉴얼)
 * 인명부와 시각적으로 분리된 독립 카드 UI
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { HumanRelationsPlaybook } from './HumanRelationsPlaybook'

export class NetworkPlaybookErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; err: Error | null }
> {
  state = { hasError: false, err: null as Error | null }

  static getDerivedStateFromError(err: Error) {
    return { hasError: true, err }
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error('[NetworkPlaybookErrorBoundary]', err, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900"
        >
          <p className="m-0 mb-2 font-extrabold text-[15px]">인간관계론 영역 렌더 오류</p>
          <p className="m-0 text-xs leading-relaxed break-words">
            {this.state.err ? String(this.state.err.message || this.state.err) : '알 수 없는 오류'}
          </p>
          <p className="mt-3 m-0 text-[11px] opacity-85">브라우저 개발자 도구(F12) 콘솔에 자세한 스택이 기록되었습니다.</p>
        </div>
      )
    }
    return this.props.children
  }
}

type Props = {
  /** 카드 내부 본문 래퍼 (추가 spacing 등) */
  innerClassName?: string
  /** 카드 바깥 (상세 페이지에서 max-width·패딩 정렬용) */
  wrapperClassName?: string
}

export function NetworkHumanRelationsSection({ innerClassName, wrapperClassName }: Props) {
  const inner = innerClassName ?? ''

  const card = (
    <section
      id="network-human-relations-playbook"
      aria-label="인간관계론 전역 매뉴얼"
      className="rounded-2xl border border-violet-200/90 bg-white p-6 sm:p-8 shadow-md shadow-slate-300/40 border-l-[5px] border-l-violet-500 min-h-[200px] box-border"
    >
      <header className="mb-6 sm:mb-8">
        <span className="text-[10px] font-extrabold text-violet-600 tracking-[0.2em]">PLAYBOOK · MANUAL</span>
        <h2 className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">인간관계론</h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed max-w-2xl m-0">
          경조사·선물·메시지 등 <strong className="text-violet-700">나만의 대인관계 원칙</strong>을 누적합니다. 모든 연락처에 공통으로 적용되는
          매뉴얼입니다.
        </p>
      </header>
      <div className={inner}>
        <NetworkPlaybookErrorBoundary>
          <HumanRelationsPlaybook variant="embedded" />
        </NetworkPlaybookErrorBoundary>
      </div>
    </section>
  )

  if (wrapperClassName) {
    return <div className={wrapperClassName}>{card}</div>
  }
  return card
}
