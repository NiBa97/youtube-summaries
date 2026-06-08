import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { VisualLab } from './VisualLab.tsx'
import { ComparePage } from './ComparePage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {window.location.pathname === '/visual-lab' ? <VisualLab /> : window.location.pathname === '/compare' ? <ComparePage /> : <App />}
  </StrictMode>,
)
