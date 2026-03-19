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
      <UndoRedoKeyListener undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo} />
      {children}
    </UndoRedoContext.Provider>
  )
}

/** input/textarea/contenteditable 포커스 시 브라우저 기본 Undo/Redo 사용, 전역 리스너 무시 */
function isTypingInEditable(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName?.toUpperCase()
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true
  if ((el as HTMLElement).isContentEditable) return true
  return false
}

function UndoRedoKeyListener({ undo, redo, canUndo, canRedo }: {
  undo: () => Promise<void>
  redo: () => Promise<void>
  canUndo: boolean
  canRedo: boolean
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTypingInEditable()) return
      const isMac = navigator.platform?.toLowerCase().includes('mac')
      const mod = isMac ? e.metaKey : e.ctrlKey
      if (!mod) return
      if (e.key === 'z' || e.key === 'Z') {
        if (e.shiftKey) {
          if (canRedo) { e.preventDefault(); redo() }
        } else {
          if (canUndo) { e.preventDefault(); undo() }
        }
      }
    }
    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [undo, redo, canUndo, canRedo])
  return null
}

export function useUndoRedo(): UndoRedoContextType {
  const ctx = useContext(UndoRedoContext)
  if (!ctx) throw new Error('useUndoRedo must be used within UndoRedoProvider')
  return ctx
}
