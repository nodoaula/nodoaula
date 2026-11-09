import { useCallback, useEffect, useState } from 'react'

import { get, loadCsrfToken } from '../lib/apiClient.js'

// El plan gratuito suspende el backend tras quince minutos sin tráfico, y
// volver a arrancarlo llevó entre 3:00 y 3:07 en las medidas de producción.
// Cinco minutos dejan margen antes de dar por caído el servidor.
const SERVER_WAKE_TIMEOUT_MS = 300_000

export const SERVER_STATUS = {
  STARTING: 'starting',
  READY: 'ready',
  UNREACHABLE: 'unreachable',
}

/**
 * Estado del servidor y la función que vuelve a preguntarle tras darlo por
 * inalcanzable.
 */
export function useServerStatus() {
  const [status, setStatus] = useState(SERVER_STATUS.STARTING)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    // StrictMode ejecuta el efecto dos veces en desarrollo; este indicador
    // evita que una comprobación ya descartada escriba el estado.
    let active = true

    // El token CSRF se pide aquí, al cargar, para que ya exista cuando el
    // usuario envíe el primer formulario.
    get('/health', { totalTimeoutMs: SERVER_WAKE_TIMEOUT_MS })
      .then(() => loadCsrfToken())
      .then(() => {
        if (active) setStatus(SERVER_STATUS.READY)
      })
      .catch((error) => {
        if (!active) return

        // El cliente conserva la causa original; registrarla es lo que permite
        // distinguir después un tiempo agotado de un fallo de transporte.
        console.error('No se pudo comprobar el estado del servidor', error)
        setStatus(SERVER_STATUS.UNREACHABLE)
      })

    return () => {
      active = false
    }
  }, [attempt])

  const retry = useCallback(() => {
    setStatus(SERVER_STATUS.STARTING)
    setAttempt((count) => count + 1)
  }, [])

  return [status, retry]
}
