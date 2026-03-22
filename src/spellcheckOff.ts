/**
 * 앱 전역에서 브라우저 맞춤법 밑줄(스펠체크)을 끕니다.
 * 동적으로 마운트되는 입력 필드까지 MutationObserver로 처리합니다.
 */
function isTextLikeInput(el: HTMLInputElement): boolean {
  const t = el.type
  return t === 'text' || t === 'search' || t === 'url' || t === 'email' || t === 'tel' || t === ''
}

function applySpellcheckOff(root: HTMLElement): void {
  root.querySelectorAll('textarea').forEach((el) => {
    el.spellcheck = false
  })
  root.querySelectorAll('input').forEach((el) => {
    if (el instanceof HTMLInputElement && isTextLikeInput(el)) el.spellcheck = false
  })
  root.querySelectorAll('[contenteditable="true"]').forEach((el) => {
    if (el instanceof HTMLElement) el.spellcheck = false
  })
}

/** main에서 한 번 호출. #root 이하만 관찰합니다. */
export function installGlobalSpellcheckOff(): () => void {
  const root = document.getElementById('root')
  if (!root) return () => {}

  let raf = 0
  const run = () => {
    applySpellcheckOff(root)
  }
  const schedule = () => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      raf = 0
      run()
    })
  }

  run()
  const mo = new MutationObserver(schedule)
  mo.observe(root, { childList: true, subtree: true })

  return () => {
    cancelAnimationFrame(raf)
    mo.disconnect()
  }
}
