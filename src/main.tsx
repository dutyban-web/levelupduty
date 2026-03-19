import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { UndoRedoProvider } from './contexts/UndoRedoContext'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UndoRedoProvider>
      <App />
    </UndoRedoProvider>
  </StrictMode>,
)
