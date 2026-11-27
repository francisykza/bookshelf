import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { showDiagnostics } from './diag'
import { seedPilotLibrary } from './features/pisoLab/sampleLibrary'
import { RedDeSeguridad } from './ui/RedDeSeguridad'
import { recargarUnaVez } from './ui/recarga'

// Piloto: la biblioteca de prueba se prepara antes de que la app lea el almacenamiento
if (location.search.includes('piloto=')) {
  performance.setResourceTimingBufferSize?.(3000)
  try {
    seedPilotLibrary(location, localStorage)
  } catch (error) {
    console.warn('Piloto: sin almacenamiento para la biblioteca de prueba', error)
  }
}

// 1.159: si un trozo de código de otra versión ya no está (la app llevaba días abierta), Vite avisa antes de fallar: se recarga
// una vez y la página nueva trae los suyos. Si no, lo recoge la red de seguridad (src/ui/RedDeSeguridad.jsx)
window.addEventListener('vite:preloadError', (event) => {
  if (recargarUnaVez()) event.preventDefault()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RedDeSeguridad>
      <App />
    </RedDeSeguridad>
  </StrictMode>,
)

// PWA: el service worker solo en la versión compilada (en desarrollo guardaría módulos a medio editar)
// En el piloto no: las medidas contarían lo guardado por él, y una versión nueva tardaría en verse
if ('serviceWorker' in navigator && import.meta.env.PROD && !location.search.includes('piloto=')) {
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
