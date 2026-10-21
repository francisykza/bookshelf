import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { showDiagnostics } from './diag'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA: el service worker solo en la versión compilada (en desarrollo guardaría módulos a medio editar)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Una versión nueva espera; se activa cuando la app pasa a segundo plano, sin recargar (SPEC §11.6)
        const activate = () => {
          if (document.visibilityState === 'hidden' && reg.waiting) reg.waiting.postMessage('activar-version')
        }
        document.addEventListener('visibilitychange', activate)
      })
      .catch(() => {})
  })
}

showDiagnostics()
