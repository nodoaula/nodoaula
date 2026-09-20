import { useEffect, useState } from 'react'

import { get } from '../lib/apiClient.js'

// El plan gratuito suspende el backend tras quince minutos sin tráfico y
// volver a arrancarlo lleva cerca de dos minutos. Sin aviso, esa espera se ve
// como una página que no carga.
const SERVER_WAKE_TIMEOUT_MS = 180_000

export const SERVER_STATUS = {
  STARTING: 'starting',
  READY: 'ready',
  UNREACHABLE: 'unreachable',
}

export function useServerStatus() {
  const [status, setStatus] = useState(SERVER_STATUS.STARTING)

  useEffect(() => {
    // StrictMode ejecuta el efecto dos veces en desarrollo; este indicador
    // evita que una comprobación ya descartada escriba el estado.
    let active = true

    get('/health', { totalTimeoutMs: SERVER_WAKE_TIMEOUT_MS })
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
  }, [])

  return status
}
