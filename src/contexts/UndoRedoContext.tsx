import { createContext, useContext, useCallback, useRef, useState, useEffect, type ReactNode } from 'react'

/** 커맨드 패턴 액션: executeReverse=Undo, executeForward=Redo */
export type UndoAction = {
  actionType: string
  id?: string
  table?: string
  field?: string
  oldValue?: unknown
  newValue?: unknown
  executeReverse: () => Promise<void>
  executeForward: () => Promise<void>
}

type UndoRedoContextType = {
  pushUndo: (action: UndoAction) => void
  undo: () => Promise<void>
  redo: () => Promise<void>
  canUndo: boolean
  canRedo: boolean
}

const UndoRedoContext = createContext<UndoRedoContextType | null>(null)

const MAX_STACK = 50

export function UndoRedoProvider({ children }: { children: ReactNode }) {
  const undoStackRef = useRef<UndoAction[]>([])
  const redoStackRef = useRef<UndoAction[]>([])
  const [stackVersion, setStackVersion] = useState(0)
  const isExecuting = useRef(false)

  const pushUndo = useCallback((action: UndoAction) => {
    undoStackRef.current = [...undoStackRef.current.slice(-(MAX_STACK - 1)), action]
    redoStackRef.current = []
    setStackVersion(v => v + 1)
  }, [])

  const undo = useCallback(async () => {
    if (undoStackRef.current.length === 0 || isExecuting.current) return
    isExecuting.current = true
    const action = undoStackRef.current[undoStackRef.current.length - 1]
    undoStackRef.current = undoStackRef.current.slice(0, -1)
    try {
      await action.executeReverse()
      redoStackRef.current = [...redoStackRef.current, action]
    } catch (e) {
      console.error('[Undo] executeReverse 실패:', e)
      undoStackRef.current = [...undoStackRef.current, action]
    } finally {
      isExecuting.current = false
      setStackVersion(v => v + 1)
    }
  }, [])

  const redo = useCallback(async () => {
    if (redoStackRef.current.length === 0 || isExecuting.current) return
    isExecuting.current = true
    const action = redoStackRef.current[redoStackRef.current.length - 1]
    redoStackRef.current = redoStackRef.current.slice(0, -1)
    try {
      await action.executeForward()
      undoStackRef.current = [...undoStackRef.current, action]
    } catch (e) {
      console.error('[Redo] executeForward 실패:', e)
      redoStackRef.current = [...redoStackRef.current, action]
    } finally {
      isExecuting.current = false
      setStackVersion(v => v + 1)
    }
  }, [])

  const canUndo = undoStackRef.current.length > 0
  const canRedo = redoStackRef.current.length > 0
  void stackVersion

  const value: UndoRedoContextType = {
    pushUndo,
    undo,
    redo,
    canUndo,
    canRedo,
  }

  return (
    <UndoRedoContext.Provider value={value}>
      <UndoRedoKeyListener undo={undo} redo={redo} />
      {children}
    </UndoRedoContext.Provider>
  )
}

/** input/textarea/contenteditable 포커스 시 브라우저 기본 Undo/Redo 사용, 전역 리스너 무시 */
function isTypingInEditable(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName?.toUpperCase()
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if ((el as HTMLElement).isContentEditable) return true
  return false
}

/**
 * 전역 단축키 (포커스가 입력 필드가 아닐 때만)
 * - Undo: Ctrl+Z / Cmd+Z
 * - Redo: Ctrl+Shift+Z / Cmd+Shift+Z, Windows: Ctrl+Y
 * canUndo/canRedo에 의존하지 않고 undo()/redo() 내부에서 스택 검사 (클로저/리렌더 타이밍 이슈 방지)
 */
function UndoRedoKeyListener({ undo, redo }: {
  undo: () => Promise<void>
  redo: () => Promise<void>
}) {
  const undoRef = useRef(undo)
  const redoRef = useRef(redo)
  undoRef.current = undo
  redoRef.current = redo

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return
      if (isTypingInEditable()) return

      const isMac = typeof navigator !== 'undefined' && navigator.platform?.toLowerCase().includes('mac')
      const mod = isMac ? e.metaKey : e.ctrlKey
      if (!mod || e.altKey) return

      const code = e.code
      const isZ = code === 'KeyZ'
      const isY = code === 'KeyY'

      // Redo: Shift+Z (또는 Mac에서 흔한 조합)
      if (isZ && e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        void redoRef.current()
        return
      }

      // Undo: Z (Shift 없음)
      if (isZ && !e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        void undoRef.current()
        return
      }

      // Windows/Linux: Ctrl+Y = Redo (Office 등과 동일)
      if (!isMac && isY && !e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        void redoRef.current()
        return
      }
    }
    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [])
  return null
}

export function useUndoRedo(): UndoRedoContextType {
  const ctx = useContext(UndoRedoContext)
  if (!ctx) throw new Error('useUndoRedo must be used within UndoRedoProvider')
  return ctx
}
