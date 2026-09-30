import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './app/App.jsx'
import './index.css'

// Durante un despliegue, Render sustituye los archivos del sitio estático. Una
// pestaña abierta desde antes pide fragmentos que ya no existen y se queda en
// blanco. Vite avisa con este evento y una recarga trae la versión nueva. La
// marca en sessionStorage impide un bucle de recargas si el fallo se repite.
const LAST_RELOAD_KEY = 'nodoaula:last-preload-reload'
const MIN_RELOAD_INTERVAL_MS = 10_000

window.addEventListener('vite:preloadError', (event) => {
  try {
    const lastReload = Number(sessionStorage.getItem(LAST_RELOAD_KEY)) || 0
    if (Date.now() - lastReload < MIN_RELOAD_INTERVAL_MS) return

    sessionStorage.setItem(LAST_RELOAD_KEY, String(Date.now()))
  } catch {
    // Un navegador con el almacenamiento bloqueado lanza al leerlo o
    // escribirlo. Sin registro se pierde la protección contra el bucle, pero
    // recargar una vez sigue siendo mejor que dejar la pestaña en blanco.
  }

  // Evita que Vite propague el error mientras la página se recarga.
  event.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
