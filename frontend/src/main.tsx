import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Landing from './landing/Landing.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {window.location.pathname.startsWith('/app') ? <App /> : <Landing />}
  </StrictMode>,
)
