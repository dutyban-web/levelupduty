import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import { UndoRedoProvider } from './contexts/UndoRedoContext'
import { installGlobalSpellcheckOff } from './spellcheckOff'
import App from './App.tsx'

installGlobalSpellcheckOff()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <UndoRedoProvider>
        <App />
      </UndoRedoProvider>
    </HashRouter>
  </StrictMode>,
)
