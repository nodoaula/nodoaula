import { useEffect, useState } from 'react'

import { get } from '../lib/apiClient.js'

/**
 * Estado del backend mientras la aplicación arranca.
 *
 * El plan gratuito de Render suspende el servicio tras quince minutos sin
 * tráfico (ADR-004), así que la primera visita puede esperar cerca de dos
 * minutos. Sin aviso, esa espera se ve como una página que no carga.
 */

// El arranque en frío medido en producción el 19 de septiembre de 2026 fue de
// 114,8 s. Tres minutos dejan margen sobre esa medición. Este es el único
// punto del proyecto que amplía el plazo por defecto del cliente de API, y lo
// hace porque aquí esperar sí es la respuesta correcta.
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

    // El cliente ya reintenta los GET con espera creciente, de modo que aquí
    // solo se llega cuando el backend respondió o cuando se agotó el plazo.
    get('/health', { totalTimeoutMs: SERVER_WAKE_TIMEOUT_MS })
      .then(() => {
        if (active) setStatus(SERVER_STATUS.READY)
      })
      .catch((error) => {
        if (!active) return

        // El cliente distingue el tiempo agotado de un fallo de transporte y
        // conserva la causa original. Registrarlo es lo que hace útil ese
        // trabajo: sin esto, el error se descartaría y no quedaría rastro de
        // por qué el servidor no respondió.
        console.error('No se pudo comprobar el estado del servidor', error)
        setStatus(SERVER_STATUS.UNREACHABLE)
      })

    return () => {
      active = false
    }
  }, [])

  return status
}
